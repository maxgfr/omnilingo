use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::State;

use crate::{BaseDirState, DbState};

fn shared_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client")
    })
}

/// Send a request with exponential backoff retry on 429 (Too Many Requests).
async fn send_with_retry(
    req: reqwest::Request,
) -> Result<reqwest::Response, String> {
    let client = shared_client();
    let mut delay = std::time::Duration::from_secs(2);
    for attempt in 0..4 {
        let req_clone = req.try_clone().ok_or("Failed to clone request for retry")?;
        let resp = client.execute(req_clone).await.map_err(|e| format!("Network error: {}", e))?;

        if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS && attempt < 3 {
            log::warn!("Rate limited (429), retry {}/3 in {:?}", attempt + 1, delay);
            tokio::time::sleep(delay).await;
            delay *= 2;
            continue;
        }

        return Ok(resp);
    }
    Err("Max retries exceeded for 429 rate limit".into())
}

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
        "glm" => "glm-4.7-flash",
        "claude-cli" | "claude-code" => "claude-sonnet-4-6",
        "ollama" => "",
        "lmstudio" => "",
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
    let db = state.db();
    get_ai_settings(&db)
}

#[tauri::command]
pub fn set_ai_provider(state: State<'_, DbState>, provider: String, api_key: String, model: String) -> Result<(), String> {
    let db = state.db();
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
        "claude-cli" | "claude-code" => call_claude_cli(&settings.model, &single_prompt, cwd).await,
        "codex" => call_codex_cli(&single_prompt, cwd).await,
        "ollama" => call_openai_compatible("http://localhost:11434/v1/chat/completions", settings, messages).await,
        "lmstudio" => call_openai_compatible("http://localhost:1234/v1/chat/completions", settings, messages).await,
        "anthropic" => call_anthropic(settings, messages).await,
        "openai" => call_openai_compatible("https://api.openai.com/v1/chat/completions", settings, messages).await,
        "gemini" => call_gemini(settings, messages).await,
        "mistral" => call_openai_compatible("https://api.mistral.ai/v1/chat/completions", settings, messages).await,
        "glm" => call_anthropic_compatible("https://api.z.ai/api/anthropic/v1/messages", settings, messages).await,
        // "custom" is handled in call_ai_with_custom_url which reads the URL from DB
        "custom" => Err("Custom provider: use call_ai_with_custom_url instead".into()),
        other => Err(format!("Unknown AI provider: {}", other)),
    }
}

/// Call AI with the configured provider — no fallback.
pub async fn call_ai_with_fallback(
    settings: &AiSettings,
    messages: &[ChatMessage],
    cwd: &std::path::Path,
) -> Result<String, String> {
    call_provider(settings, messages, cwd).await.map_err(|e| {
        log::warn!("AI provider '{}' failed: {}", settings.provider, e);
        e
    })
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Test a specific AI provider directly — NO fallback.
/// Used by Settings to verify the selected provider actually works.
#[tauri::command]
pub async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: String,
    custom_url: Option<String>,
    base_dir: State<'_, BaseDirState>,
) -> Result<String, String> {
    let final_model = if model.is_empty() { default_model(&provider).to_string() } else { model };
    let settings = AiSettings {
        provider: provider.clone(),
        api_key,
        model: final_model,
    };
    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: "Reply with exactly: OK".into() }];

    // For "custom" provider, use the custom URL
    if provider == "custom" {
        let url = custom_url.unwrap_or_default();
        if url.is_empty() {
            return Err("Custom provider URL is required".into());
        }
        return call_openai_compatible(&url, &settings, &messages).await;
    }

    call_provider(&settings, &messages, &cwd).await
}

/// Read custom AI URL from settings
fn get_custom_url(db: &rusqlite::Connection) -> String {
    db.query_row(
        "SELECT COALESCE(ai_custom_url, '') FROM settings WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ).unwrap_or_default()
}

/// Save custom AI URL
#[tauri::command]
pub fn set_ai_custom_url(state: State<'_, DbState>, url: String) -> Result<(), String> {
    let db = state.db();
    db.execute("UPDATE settings SET ai_custom_url = ?1 WHERE id = 1", [&url])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Call AI with support for custom provider (reads URL from DB)
async fn call_with_custom_support(
    settings: &AiSettings,
    messages: &[ChatMessage],
    cwd: &std::path::Path,
    custom_url: &str,
) -> Result<String, String> {
    if settings.provider == "custom" {
        if custom_url.is_empty() {
            return Err("Custom provider URL is not configured. Go to Settings.".into());
        }
        return call_openai_compatible(custom_url, settings, messages).await;
    }
    call_ai_with_fallback(settings, messages, cwd).await
}

#[tauri::command]
pub async fn ask_ai(
    prompt: String,
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
) -> Result<String, String> {
    let (settings, custom_url) = {
        let db = state.db();
        (get_ai_settings(&db)?, get_custom_url(&db))
    };
    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    call_with_custom_support(&settings, &messages, &cwd, &custom_url).await
}

/// Multi-turn AI conversation
#[tauri::command]
pub async fn ask_ai_conversation(
    messages: Vec<ChatMessage>,
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
) -> Result<String, String> {
    let (settings, custom_url) = {
        let db = state.db();
        (get_ai_settings(&db)?, get_custom_url(&db))
    };
    let cwd = base_dir.0.clone();
    call_with_custom_support(&settings, &messages, &cwd, &custom_url).await
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
    let (settings, source_lang, target_lang, custom_url) = {
        let db = state.db();
        let s = get_ai_settings(&db)?;
        let cu = get_custom_url(&db);
        let (sl, tl): (String, String) = db.query_row(
            "SELECT source_lang, target_lang FROM language_pairs WHERE id = ?1",
            [pair_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;
        (s, sl, tl, cu)
    };

    let theme_str = theme.as_deref().unwrap_or("general everyday vocabulary");
    let category = theme.as_deref().unwrap_or("general");
    let prompt = format!(
        "Generate exactly {count} {target_lang} vocabulary words for a {source_lang}-speaking {level} learner. Theme: {theme_str}.\n\n\
        Return ONLY this JSON array — no markdown fences, no prose:\n\
        [{{\"source\": \"<word in {source_lang}>\", \"target\": \"<word in {target_lang}>\", \"gender\": \"m\"|\"f\"|\"n\"|null, \"level\": \"{level}\", \"category\": \"{category}\"}}]\n\n\
        Rules:\n\
        - source field = the {source_lang} (native) word; target field = the {target_lang} (learning) word.\n\
        - gender is only for {target_lang} nouns with grammatical gender; null otherwise.\n\
        - Pick practical, frequently used words. Each word must be unique.\n\
        - Match the {level} difficulty exactly."
    );

    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    let response = call_with_custom_support(&settings, &messages, &cwd, &custom_url).await?;

    // Extract JSON array from response (AI might wrap in markdown fences)
    let json_str = extract_json_array(&response)?;
    let words: Vec<serde_json::Value> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse AI response as JSON array: {}. Response: {}", e, &response[..200.min(response.len())]))?;

    // Insert into DB
    let db = state.db();
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
    let (settings, source_lang, target_lang, custom_url) = {
        let db = state.db();
        let s = get_ai_settings(&db)?;
        let cu = get_custom_url(&db);
        let (sl, tl): (String, String) = db.query_row(
            "SELECT source_lang, target_lang FROM language_pairs WHERE id = ?1",
            [pair_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;
        (s, sl, tl, cu)
    };

    let prompt = format!(
        "Generate exactly {count} grammar lessons for a {source_lang}-speaking {level} learner studying {target_lang}.\n\n\
        Return ONLY this JSON array — no markdown fences, no prose:\n\
        [{{\n\
          \"id\": \"<unique-kebab-case-id>\",\n\
          \"title\": \"<topic title in {target_lang}>\",\n\
          \"title_source\": \"<same title in {source_lang}>\",\n\
          \"explanation\": \"<2-3 paragraphs in {source_lang}, use **bold** for key terms>\",\n\
          \"key_points\": [\"<3-5 short rules in {source_lang}>\"],\n\
          \"examples\": [\n\
            {{\"source\": \"<example in {target_lang}>\", \"target\": \"<translation in {source_lang}>\", \"highlight\": \"<key word/phrase>\"}}\n\
          ],\n\
          \"exercises\": [\n\
            {{\"type\": \"qcm\", \"question\": \"<question>\", \"options\": [\"<a>\",\"<b>\",\"<c>\",\"<d>\"], \"correctIndex\": 0}},\n\
            {{\"type\": \"fill\", \"sentence\": \"<sentence in {target_lang} with ___ blank>\", \"answer\": \"<correct word>\", \"hint\": \"<short hint in {source_lang}>\"}},\n\
            {{\"type\": \"trueFalse\", \"statement\": \"<statement in {target_lang}>\", \"isTrue\": true, \"explanation\": \"<why in {source_lang}>\"}}\n\
          ]\n\
        }}]\n\n\
        Rules:\n\
        - Each topic: 3-4 examples and 3-6 exercises (mix of qcm, fill, trueFalse).\n\
        - Cover fundamental grammar concepts at {level}.\n\
        - IDs must be unique kebab-case strings (e.g. \"present-tense-regular\").\n\
        - Exercise field names must match exactly: qcm uses correctIndex, trueFalse uses isTrue."
    );

    let cwd = base_dir.0.clone();
    let messages = vec![ChatMessage { role: "user".into(), content: prompt }];
    let response = call_with_custom_support(&settings, &messages, &cwd, &custom_url).await?;

    let json_str = extract_json_array(&response)?;
    let topics: Vec<serde_json::Value> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse grammar JSON: {}. Response: {}", e, &response[..200.min(response.len())]))?;

    let db = state.db();

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
    let client = shared_client();

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

    let req = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &settings.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let resp = send_with_retry(req).await?;

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

/// Anthropic-compatible API at a custom URL (e.g. Z.ai GLM Coding Plan)
async fn call_anthropic_compatible(url: &str, settings: &AiSettings, messages: &[ChatMessage]) -> Result<String, String> {
    if settings.api_key.is_empty() {
        return Err("API key not configured. Go to Settings.".into());
    }
    let client = shared_client();

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

    let req = client
        .post(url)
        .header("x-api-key", &settings.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let resp = send_with_retry(req).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json.get("content")
        .ok_or_else(|| format!("Response missing 'content': {}", json))?;
    let first = content.get(0)
        .ok_or_else(|| "Response 'content' array is empty".to_string())?;
    first.get("text")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Response missing 'text': {}", first))
}

/// OpenAI-compatible API (OpenAI, Mistral, Ollama, LM Studio)
async fn call_openai_compatible(url: &str, settings: &AiSettings, messages: &[ChatMessage]) -> Result<String, String> {
    if settings.api_key.is_empty() && !url.contains("localhost") {
        return Err("API key not configured. Go to Settings.".into());
    }
    let client = shared_client();
    let api_messages: Vec<serde_json::Value> = messages.iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    let body = serde_json::json!({
        "model": settings.model,
        "messages": api_messages,
        "max_tokens": 4096
    });

    let mut req_builder = client
        .post(url)
        .header("content-type", "application/json")
        .json(&body);
    if !settings.api_key.is_empty() {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", settings.api_key));
    }
    let req = req_builder
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let resp = send_with_retry(req).await?;

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
    let client = shared_client();
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

    let req = client
        .post(&url)
        .header("x-goog-api-key", &settings.api_key)
        .header("content-type", "application/json")
        .json(&body)
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let resp = send_with_retry(req).await?;

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
