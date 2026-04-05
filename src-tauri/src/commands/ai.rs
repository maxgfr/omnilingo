use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{BaseDirState, DbState};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AiSettings {
    pub provider: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Default models per provider
fn default_model(provider: &str) -> &'static str {
    match provider {
        "anthropic" => "claude-sonnet-4-6",
        "openai" => "gpt-4o-mini",
        "gemini" => "gemini-2.0-flash",
        "mistral" => "mistral-small-latest",
        "glm" => "glm-4.5",
        "claude-cli" | "claude-code" => "claude-sonnet-4-6",
        "ollama" => "llama3.2",
        "codex" => "codex-mini-latest",
        _ => "gpt-4o-mini",
    }
}

pub fn get_ai_settings(db: &rusqlite::Connection) -> Result<AiSettings, String> {
    db.query_row(
        "SELECT ai_provider, ai_api_key, ai_model FROM settings WHERE id = 1",
        [],
        |row| {
            let provider: String = row.get::<_, String>(0).unwrap_or_else(|_| "claude-code".into());
            let api_key: String = row.get::<_, String>(1).unwrap_or_default();
            let model: String = row.get::<_, String>(2).unwrap_or_default();
            Ok(AiSettings {
                model: if model.is_empty() { default_model(&provider).to_string() } else { model },
                provider,
                api_key,
            })
        },
    )
    .map_err(|e| format!("Failed to get AI settings: {}", e))
}

#[tauri::command]
pub fn get_ai_settings_cmd(state: State<'_, DbState>) -> Result<AiSettings, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut settings = get_ai_settings(&db)?;
    if settings.api_key.len() > 4 {
        let first2 = &settings.api_key[..2];
        let last2 = &settings.api_key[settings.api_key.len()-2..];
        settings.api_key = format!("{}...{}", first2, last2);
    }
    Ok(settings)
}

#[tauri::command]
pub fn set_ai_provider(state: State<'_, DbState>, provider: String, api_key: String, model: String) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let final_model = if model.is_empty() { default_model(&provider).to_string() } else { model };
    db.execute(
        "UPDATE settings SET ai_provider = ?1, ai_api_key = ?2, ai_model = ?3 WHERE id = 1",
        rusqlite::params![provider, api_key, final_model],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Core AI routing (internal, reusable) ────────────────────────────────────

/// Call a specific AI provider with a messages array. Used by all public commands.
pub async fn call_provider(
    settings: &AiSettings,
    messages: &[ChatMessage],
    cwd: &std::path::Path,
) -> Result<String, String> {
    // For CLI providers, concatenate messages into a single prompt
    let single_prompt = messages
        .iter()
        .map(|m| {
            if m.role == "system" {
                format!("[System]: {}", m.content)
            } else if m.role == "assistant" {
                format!("[Assistant]: {}", m.content)
            } else {
                m.content.clone()
            }
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    match settings.provider.as_str() {
        #[cfg(not(mobile))]
        "claude-cli" | "claude-code" => call_claude_cli(&settings.model, &single_prompt, cwd).await,
        #[cfg(not(mobile))]
        "codex" => call_codex_cli(&single_prompt, cwd).await,
        #[cfg(not(mobile))]
        "ollama" => call_openai_compatible("http://localhost:11434/v1/chat/completions", settings, messages).await,
        #[cfg(mobile)]
        "claude-cli" | "claude-code" | "codex" | "ollama" => {
            Err("Local providers (Claude CLI, Codex, Ollama) are not available on mobile. Configure an API provider in Settings.".into())
        },
        "anthropic" => call_anthropic(settings, messages).await,
        "openai" => call_openai_compatible("https://api.openai.com/v1/chat/completions", settings, messages).await,
        "gemini" => call_gemini(settings, messages).await,
        "mistral" => call_openai_compatible("https://api.mistral.ai/v1/chat/completions", settings, messages).await,
        "glm" => call_openai_compatible("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions", settings, messages).await,
        other => Err(format!("Unknown AI provider: {}", other)),
    }
}

/// Call AI with automatic fallback: try primary provider, then local providers, then cloud.
pub async fn call_ai_with_fallback(
    settings: &AiSettings,
    messages: &[ChatMessage],
    cwd: &std::path::Path,
) -> Result<String, String> {
    // Try primary provider first
    match call_provider(settings, messages, cwd).await {
        Ok(response) => Ok(response),
        Err(primary_err) => {
            log::warn!("Primary AI provider '{}' failed: {}", settings.provider, primary_err);

            // Fallback chain: try local providers first (free), then skip the primary
            let fallbacks: Vec<(&str, &str)> = vec![
                ("claude-code", "claude-sonnet-4-6"),
                ("ollama", "llama3.2"),
            ];

            for (provider, model) in &fallbacks {
                if *provider == settings.provider {
                    continue; // Already tried
                }
                let fallback_settings = AiSettings {
                    provider: provider.to_string(),
                    api_key: settings.api_key.clone(),
                    model: model.to_string(),
                };
                if let Ok(response) = call_provider(&fallback_settings, messages, cwd).await {
                    log::info!("Fallback to '{}' succeeded", provider);
                    return Ok(response);
                }
            }

            Err(format!("All AI providers failed. Primary error: {}", primary_err))
        }
    }
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ask_ai(
    prompt: String,
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
) -> Result<String, String> {
    let settings = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        get_ai_settings(&db)?
    };
    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    call_ai_with_fallback(&settings, &messages, &cwd).await
}

/// Multi-turn AI conversation
#[tauri::command]
pub async fn ask_ai_conversation(
    messages: Vec<ChatMessage>,
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
) -> Result<String, String> {
    let settings = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        get_ai_settings(&db)?
    };
    let cwd = base_dir.0.clone();
    call_ai_with_fallback(&settings, &messages, &cwd).await
}

/// Generate vocabulary words with AI and insert them into the database
#[tauri::command]
pub async fn generate_vocabulary(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    pair_id: i64,
    count: i64,
    level: String,
    theme: Option<String>,
) -> Result<i64, String> {
    let (settings, source_lang, target_lang) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let s = get_ai_settings(&db)?;
        let (sl, tl): (String, String) = db.query_row(
            "SELECT source_lang, target_lang FROM language_pairs WHERE id = ?1",
            [pair_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;
        (s, sl, tl)
    };

    let theme_str = theme.as_deref().unwrap_or("general / mixed themes");
    let prompt = format!(
        "Generate exactly {} vocabulary words for a {} learner studying {}.\n\
        Native language: {}. Theme: {}.\n\n\
        Return ONLY a valid JSON array, no markdown fences, no explanation:\n\
        [{{\"source\": \"word in {}\", \"target\": \"word in {}\", \"gender\": null, \"level\": \"{}\", \"category\": \"{}\"}}]\n\n\
        Rules:\n\
        - gender should be \"m\", \"f\", \"n\" for nouns with grammatical gender, or null\n\
        - source is in the native language, target is in the learning language\n\
        - include diverse, practical, everyday vocabulary\n\
        - each word must be unique",
        count, level, target_lang, source_lang, theme_str,
        source_lang, target_lang, level, theme.as_deref().unwrap_or("general")
    );

    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    let response = call_ai_with_fallback(&settings, &messages, &cwd).await?;

    // Extract JSON array from response (AI might wrap in markdown fences)
    let json_str = extract_json_array(&response)?;
    let words: Vec<serde_json::Value> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse AI response as JSON array: {}. Response: {}", e, &response[..200.min(response.len())]))?;

    // Insert into DB
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let mut inserted: i64 = 0;
    {
        let mut stmt = db.prepare(
            "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, gender, level, category)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        ).map_err(|e| e.to_string())?;

        for word in &words {
            let source = word.get("source").and_then(|v| v.as_str()).unwrap_or("").trim();
            let target = word.get("target").and_then(|v| v.as_str()).unwrap_or("").trim();
            if source.is_empty() || target.is_empty() { continue; }
            let gender = word.get("gender").and_then(|v| v.as_str());
            let word_level = word.get("level").and_then(|v| v.as_str()).unwrap_or(&level);
            let category = word.get("category").and_then(|v| v.as_str()).unwrap_or("general");

            if stmt.execute(rusqlite::params![pair_id, source, target, gender, word_level, category]).is_ok() {
                inserted += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(inserted)
}

/// Generate grammar topics with AI and insert them into the database
#[tauri::command]
pub async fn generate_grammar(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    pair_id: i64,
    count: i64,
    level: String,
) -> Result<i64, String> {
    let (settings, source_lang, target_lang) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let s = get_ai_settings(&db)?;
        let (sl, tl): (String, String) = db.query_row(
            "SELECT source_lang, target_lang FROM language_pairs WHERE id = ?1",
            [pair_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;
        // Get existing topic count for display_order offset
        (s, sl, tl)
    };

    let prompt = format!(
        "Generate exactly {} grammar topics for learning {} at the {} level.\n\
        All explanations should be in {} (the learner's native language).\n\
        All examples should be in {} with translations in {}.\n\n\
        Return ONLY a valid JSON array, no markdown fences:\n\
        [{{\n\
          \"id\": \"unique-kebab-case-id\",\n\
          \"title\": \"Topic title in {}\",\n\
          \"title_source\": \"Topic title in {}\",\n\
          \"explanation\": \"Detailed explanation in {} (2-3 paragraphs)\",\n\
          \"key_points\": [\"key point 1\", \"key point 2\", \"key point 3\"],\n\
          \"examples\": [\n\
            {{\"source\": \"example in {}\", \"target\": \"translation in {}\", \"highlight\": \"highlighted grammar element\"}}\n\
          ],\n\
          \"exercises\": [\n\
            {{\"type\": \"mcq\", \"question\": \"question\", \"options\": [\"a\",\"b\",\"c\",\"d\"], \"correct\": 0}},\n\
            {{\"type\": \"fill\", \"question\": \"sentence with ___ blank\", \"answer\": \"correct word\"}},\n\
            {{\"type\": \"true_false\", \"question\": \"statement\", \"answer\": true}}\n\
          ]\n\
        }}]\n\n\
        Rules:\n\
        - Each topic should have 3-4 examples and 3-4 exercises\n\
        - Cover fundamental grammar concepts for this level\n\
        - Mix exercise types (mcq, fill, true_false)\n\
        - IDs must be unique kebab-case strings",
        count, target_lang, level,
        source_lang, target_lang, source_lang,
        target_lang, source_lang, source_lang,
        target_lang, source_lang
    );

    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    let response = call_ai_with_fallback(&settings, &messages, &cwd).await?;

    let json_str = extract_json_array(&response)?;
    let topics: Vec<serde_json::Value> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse grammar JSON: {}. Response: {}", e, &response[..200.min(response.len())]))?;

    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Get next display_order
    let max_order: i64 = db.query_row(
        "SELECT COALESCE(MAX(display_order), 0) FROM grammar_topics WHERE language_pair_id = ?1",
        [pair_id],
        |row| row.get(0),
    ).unwrap_or(0);

    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let mut inserted: i64 = 0;
    {
        let mut stmt = db.prepare(
            "INSERT OR IGNORE INTO grammar_topics (id, language_pair_id, level, display_order, title, title_source, explanation, key_points, examples, exercises)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        ).map_err(|e| e.to_string())?;

        for (i, topic) in topics.iter().enumerate() {
            let id = topic.get("id").and_then(|v| v.as_str()).unwrap_or("").trim();
            if id.is_empty() { continue; }
            let title = topic.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
            let title_source = topic.get("title_source").and_then(|v| v.as_str());
            let explanation = topic.get("explanation").and_then(|v| v.as_str()).unwrap_or("").trim();
            let key_points = topic.get("key_points").map(|v| v.to_string());
            let examples = topic.get("examples").map(|v| v.to_string());
            let exercises = topic.get("exercises").map(|v| v.to_string());
            let topic_level = topic.get("level").and_then(|v| v.as_str()).unwrap_or(&level);

            if stmt.execute(rusqlite::params![
                id, pair_id, topic_level, max_order + 1 + i as i64,
                title, title_source, explanation, key_points, examples, exercises
            ]).is_ok() {
                inserted += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(inserted)
}

/// Generate verbs with conjugation tables using AI
#[tauri::command]
pub async fn generate_verbs(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    pair_id: i64,
    count: i64,
    level: String,
) -> Result<i64, String> {
    let (settings, source_lang, target_lang) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let s = get_ai_settings(&db)?;
        let (sl, tl): (String, String) = db.query_row(
            "SELECT source_lang, target_lang FROM language_pairs WHERE id = ?1",
            [pair_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;
        (s, sl, tl)
    };

    let prompt = format!(
        "Generate exactly {} common verbs in {} for a {} learner with full conjugation tables.\n\
        Translations should be in {}.\n\n\
        Return ONLY a valid JSON array, no markdown fences:\n\
        [{{\n\
          \"infinitive\": \"verb infinitive in {}\",\n\
          \"translation\": \"translation in {}\",\n\
          \"level\": \"{}\",\n\
          \"verb_type\": \"regular\" or \"irregular\" or \"modal\",\n\
          \"auxiliary\": \"haben\" or \"sein\" or null,\n\
          \"is_separable\": false,\n\
          \"conjugations\": {{\n\
            \"present\": {{\"ich\": \"...\", \"du\": \"...\", \"er/sie/es\": \"...\", \"wir\": \"...\", \"ihr\": \"...\", \"sie/Sie\": \"...\"}},\n\
            \"past\": {{\"ich\": \"...\", \"du\": \"...\", \"er/sie/es\": \"...\", \"wir\": \"...\", \"ihr\": \"...\", \"sie/Sie\": \"...\"}},\n\
            \"perfect\": {{\"ich\": \"...\", \"du\": \"...\", \"er/sie/es\": \"...\", \"wir\": \"...\", \"ihr\": \"...\", \"sie/Sie\": \"...\"}}\n\
          }},\n\
          \"examples\": [{{\"source\": \"example in {}\", \"target\": \"translation in {}\"}}]\n\
        }}]\n\n\
        Rules:\n\
        - Include the most common, practical verbs for this level\n\
        - Conjugation tenses: adapt to the target language (e.g., for German: present, past, perfect; for French: present, passe compose, imparfait, futur)\n\
        - Use person forms appropriate for the language\n\
        - Each verb should have 1-2 example sentences\n\
        - Mix regular and irregular verbs",
        count, target_lang, level, source_lang,
        target_lang, source_lang, level,
        target_lang, source_lang
    );

    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    let response = call_ai_with_fallback(&settings, &messages, &cwd).await?;

    let json_str = extract_json_array(&response)?;
    let verbs: Vec<serde_json::Value> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse verbs JSON: {}. Response: {}", e, &response[..200.min(response.len())]))?;

    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let mut inserted: i64 = 0;
    {
        let mut stmt = db.prepare(
            "INSERT OR IGNORE INTO verbs (language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        ).map_err(|e| e.to_string())?;

        for verb in &verbs {
            let infinitive = verb.get("infinitive").and_then(|v| v.as_str()).unwrap_or("").trim();
            if infinitive.is_empty() { continue; }
            let translation = verb.get("translation").and_then(|v| v.as_str()).unwrap_or("").trim();
            let verb_level = verb.get("level").and_then(|v| v.as_str()).unwrap_or(&level);
            let verb_type = verb.get("verb_type").and_then(|v| v.as_str());
            let auxiliary = verb.get("auxiliary").and_then(|v| v.as_str());
            let is_separable = verb.get("is_separable").and_then(|v| v.as_bool()).unwrap_or(false);
            let conjugations = verb.get("conjugations").unwrap_or(&serde_json::Value::Object(Default::default())).to_string();
            let examples = verb.get("examples").map(|v| v.to_string());

            if stmt.execute(rusqlite::params![
                pair_id, infinitive, translation, verb_level, verb_type, auxiliary,
                is_separable as i64, conjugations, examples
            ]).is_ok() {
                inserted += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(inserted)
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/// Extract a JSON array from AI response that may include markdown fences
fn extract_json_array(response: &str) -> Result<String, String> {
    let trimmed = response.trim();

    // Try direct parse first
    if trimmed.starts_with('[') {
        return Ok(trimmed.to_string());
    }

    // Try extracting from markdown code fences
    if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        if let Some(end) = after.find("```") {
            let json_str = after[..end].trim();
            if json_str.starts_with('[') {
                return Ok(json_str.to_string());
            }
        }
    }
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        // Skip optional language hint on same line
        let after = if let Some(nl) = after.find('\n') { &after[nl + 1..] } else { after };
        if let Some(end) = after.find("```") {
            let json_str = after[..end].trim();
            if json_str.starts_with('[') {
                return Ok(json_str.to_string());
            }
        }
    }

    // Try finding first [ and last ]
    if let (Some(start), Some(end)) = (trimmed.find('['), trimmed.rfind(']')) {
        if start < end {
            return Ok(trimmed[start..=end].to_string());
        }
    }

    Err(format!("Could not extract JSON array from AI response: {}", &trimmed[..200.min(trimmed.len())]))
}

// ─── Provider implementations ────────────────────────────────────────────────

#[cfg(not(mobile))]
async fn call_claude_cli(model: &str, prompt: &str, cwd: &std::path::Path) -> Result<String, String> {
    let cwd = cwd.to_path_buf();
    let prompt = prompt.to_string();
    let model = model.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let candidates = [
            "claude".to_string(),
            "/opt/homebrew/bin/claude".to_string(),
            "/usr/local/bin/claude".to_string(),
            format!("{}/.npm-global/bin/claude", std::env::var("HOME").unwrap_or_default()),
        ];
        let mut last_err = String::new();
        for bin in &candidates {
            match std::process::Command::new(bin)
                .args(["-p", "--model", &model])
                .arg(&prompt)
                .current_dir(&cwd)
                .output()
            {
                Ok(output) => {
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        return Err(format!("Claude CLI error: {}", stderr));
                    }
                    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
                Err(e) => { last_err = e.to_string(); }
            }
        }
        Err(format!("Claude CLI not found ({}). Install with: brew install claude-code  or  npm i -g @anthropic-ai/claude-code", last_err))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(not(mobile))]
async fn call_codex_cli(prompt: &str, cwd: &std::path::Path) -> Result<String, String> {
    let cwd = cwd.to_path_buf();
    let prompt = prompt.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let candidates = [
            "codex".to_string(),
            "/opt/homebrew/bin/codex".to_string(),
            "/usr/local/bin/codex".to_string(),
            format!("{}/.npm-global/bin/codex", std::env::var("HOME").unwrap_or_default()),
        ];
        let mut last_err = String::new();
        for bin in &candidates {
            match std::process::Command::new(bin)
                .args(["--quiet", "--approval-mode", "full-auto"])
                .arg(&prompt)
                .current_dir(&cwd)
                .output()
            {
                Ok(output) => {
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        return Err(format!("Codex CLI error: {}", stderr));
                    }
                    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
                Err(e) => { last_err = e.to_string(); }
            }
        }
        Err(format!("Codex CLI not found ({}). Install with: npm i -g @openai/codex", last_err))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Anthropic Messages API (supports message arrays natively)
async fn call_anthropic(settings: &AiSettings, messages: &[ChatMessage]) -> Result<String, String> {
    if settings.api_key.is_empty() {
        return Err("Anthropic API key not configured. Go to Settings.".into());
    }
    let client = reqwest::Client::new();

    // Anthropic: system messages go in a separate field
    let system_content: String = messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let api_messages: Vec<serde_json::Value> = messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let mut body = serde_json::json!({
        "model": settings.model,
        "max_tokens": 4096,
        "messages": api_messages
    });
    if !system_content.is_empty() {
        body["system"] = serde_json::Value::String(system_content);
    }

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &settings.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json.get("content")
        .ok_or_else(|| format!("Anthropic response missing 'content': {}", json))?;
    let first = content.get(0)
        .ok_or_else(|| "Anthropic response 'content' array is empty".to_string())?;
    first.get("text")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Anthropic response missing 'text': {}", first))
}

/// OpenAI-compatible API (OpenAI, Mistral, GLM, Ollama)
async fn call_openai_compatible(url: &str, settings: &AiSettings, messages: &[ChatMessage]) -> Result<String, String> {
    if settings.api_key.is_empty() && !url.contains("localhost") {
        return Err("API key not configured. Go to Settings.".into());
    }
    let client = reqwest::Client::new();
    let api_messages: Vec<serde_json::Value> = messages.iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let body = serde_json::json!({
        "model": settings.model,
        "messages": api_messages,
        "max_tokens": 4096
    });

    let mut req = client
        .post(url)
        .header("content-type", "application/json")
        .json(&body);
    if !settings.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", settings.api_key));
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let choices = json.get("choices")
        .ok_or_else(|| format!("API response missing 'choices': {}", json))?;
    let first = choices.get(0)
        .ok_or_else(|| "API response 'choices' array is empty".to_string())?;
    let message = first.get("message")
        .ok_or_else(|| format!("API response missing 'message': {}", first))?;
    message.get("content")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("API response missing 'content': {}", message))
}

/// Google Gemini API
async fn call_gemini(settings: &AiSettings, messages: &[ChatMessage]) -> Result<String, String> {
    if settings.api_key.is_empty() {
        return Err("Gemini API key not configured. Go to Settings.".into());
    }
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        settings.model
    );

    // Gemini uses a different format: contents array with parts
    let contents: Vec<serde_json::Value> = messages.iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { "user" };
            serde_json::json!({"role": role, "parts": [{"text": m.content}]})
        })
        .collect();

    let mut body = serde_json::json!({ "contents": contents });

    // Add system instruction if present
    let system_content: String = messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    if !system_content.is_empty() {
        body["systemInstruction"] = serde_json::json!({"parts": [{"text": system_content}]});
    }

    let resp = client
        .post(&url)
        .header("x-goog-api-key", &settings.api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let candidates = json.get("candidates")
        .ok_or_else(|| format!("Gemini response missing 'candidates': {}", json))?;
    let first = candidates.get(0)
        .ok_or_else(|| "Gemini response 'candidates' array is empty".to_string())?;
    let content = first.get("content")
        .ok_or_else(|| format!("Gemini response missing 'content': {}", first))?;
    let parts = content.get("parts")
        .ok_or_else(|| format!("Gemini response missing 'parts': {}", content))?;
    let first_part = parts.get(0)
        .ok_or_else(|| "Gemini response 'parts' array is empty".to_string())?;
    first_part.get("text")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Gemini response missing 'text': {}", first_part))
}
