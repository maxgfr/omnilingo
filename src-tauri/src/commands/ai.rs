use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{BaseDirState, DbState};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AiSettings {
    pub provider: String,
    pub api_key: String,
    pub model: String,
}

/// Default models per provider
fn default_model(provider: &str) -> &'static str {
    match provider {
        "anthropic" => "claude-haiku-4-5-20251001",
        "openai" => "gpt-4o-mini",
        "gemini" => "gemini-2.0-flash",
        "mistral" => "mistral-small-latest",
        "glm" => "glm-4-flash",
        "claude-cli" => "claude-haiku-4-5-20251001",
        "ollama" => "llama3.2",
        _ => "gpt-4o-mini",
    }
}

fn get_ai_settings(db: &rusqlite::Connection) -> Result<AiSettings, String> {
    db.query_row(
        "SELECT ai_provider, ai_api_key, ai_model FROM settings WHERE id = 1",
        [],
        |row| {
            let provider: String = row.get::<_, String>(0).unwrap_or_else(|_| "anthropic".into());
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
    // Mask the API key for frontend display
    if settings.api_key.len() > 8 {
        let visible = &settings.api_key[..4];
        settings.api_key = format!("{}...{}", visible, &settings.api_key[settings.api_key.len()-4..]);
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

    match settings.provider.as_str() {
        "claude-cli" => call_claude_cli(&prompt, &cwd).await,
        "anthropic" => call_anthropic(&settings, &prompt).await,
        "openai" => call_openai_compatible("https://api.openai.com/v1/chat/completions", &settings, &prompt).await,
        "gemini" => call_gemini(&settings, &prompt).await,
        "mistral" => call_openai_compatible("https://api.mistral.ai/v1/chat/completions", &settings, &prompt).await,
        "glm" => call_openai_compatible("https://open.bigmodel.cn/api/paas/v4/chat/completions", &settings, &prompt).await,
        "ollama" => call_openai_compatible("http://localhost:11434/v1/chat/completions", &settings, &prompt).await,
        other => Err(format!("Unknown AI provider: {}", other)),
    }
}

/// Claude CLI fallback (no API key needed)
async fn call_claude_cli(prompt: &str, cwd: &std::path::Path) -> Result<String, String> {
    let cwd = cwd.to_path_buf();
    let prompt = prompt.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let output = std::process::Command::new("claude")
            .args(["-p", "--model", "claude-haiku-4-5-20251001"])
            .arg(&prompt)
            .current_dir(&cwd)
            .output()
            .map_err(|e| format!("Claude CLI not found: {}. Install it or use an API key.", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Claude CLI error: {}", stderr));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Anthropic Messages API
async fn call_anthropic(settings: &AiSettings, prompt: &str) -> Result<String, String> {
    if settings.api_key.is_empty() {
        return Err("Clé API Anthropic non configurée. Allez dans Paramètres.".into());
    }
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": settings.model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &settings.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Anthropic: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Réponse Anthropic invalide".to_string())
}

/// OpenAI-compatible API (works for OpenAI, Mistral, GLM, Ollama)
async fn call_openai_compatible(url: &str, settings: &AiSettings, prompt: &str) -> Result<String, String> {
    if settings.api_key.is_empty() && !url.contains("localhost") {
        return Err("Clé API non configurée. Allez dans Paramètres.".into());
    }
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": settings.model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048
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
        .map_err(|e| format!("Erreur réseau: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Réponse API invalide".to_string())
}

/// Google Gemini API
async fn call_gemini(settings: &AiSettings, prompt: &str) -> Result<String, String> {
    if settings.api_key.is_empty() {
        return Err("Clé API Gemini non configurée. Allez dans Paramètres.".into());
    }
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        settings.model, settings.api_key
    );
    let body = serde_json::json!({
        "contents": [{"parts": [{"text": prompt}]}]
    });

    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Gemini: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API {} : {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Réponse Gemini invalide".to_string())
}
