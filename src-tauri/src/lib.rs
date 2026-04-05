use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;

pub struct DbState(pub Mutex<rusqlite::Connection>);
pub struct BaseDirState(pub PathBuf);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init());

    // Desktop-only plugins (process & updater are not available on mobile)
    #[cfg(not(mobile))]
    {
        builder = builder.plugin(tauri_plugin_process::init());
        if !cfg!(debug_assertions) {
            builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        }
    }

    // MCP Bridge for E2E testing (debug builds only, requires --features mcp)
    #[cfg(feature = "mcp")]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let base_dir = if cfg!(debug_assertions) && !cfg!(mobile) {
                // Desktop debug: use project root
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .expect("Failed to get project root")
                    .to_path_buf()
            } else if cfg!(mobile) {
                // Mobile: use app data directory (sandboxed storage)
                app.path()
                    .app_data_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
            } else {
                // Desktop release: use resource dir
                app.path()
                    .resource_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
            };

            let _ = std::fs::create_dir_all(base_dir.join("memory/sessions"));
            let _ = std::fs::create_dir_all(base_dir.join("exercises"));

            let conn = db::init_database(&base_dir).expect("Failed to init DB");
            // Ensure settings row exists (onboarding creates the language pair)
            commands::import::ensure_settings_exist(&conn).ok();

            app.manage(DbState(Mutex::new(conn)));
            app.manage(BaseDirState(base_dir));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::update_setting,
            commands::settings::get_language_pairs,
            commands::settings::set_active_language_pair,
            commands::settings::update_streak,
            commands::memory::read_memory_file,
            commands::memory::write_memory_file,
            commands::ai::ask_ai,
            commands::ai::ask_ai_conversation,
            commands::ai::get_ai_settings_cmd,
            commands::ai::set_ai_provider,
            commands::ai::generate_vocabulary,
            commands::ai::generate_grammar,
            commands::ai::generate_verbs,
            commands::import::import_builtin_data,
            commands::import::import_from_file,
            commands::dictionary::get_words,
            commands::dictionary::search_words,
            commands::dictionary::get_unlearned_words,
            commands::dictionary::get_word_count,
            commands::dictionary::get_categories,
            commands::srs::add_word_to_srs,
            commands::srs::get_due_cards,
            commands::srs::get_due_count,
            commands::srs::review_card,
            commands::srs::get_srs_stats,
            commands::grammar::get_grammar_topics,
            commands::grammar::mark_grammar_completed,
            commands::conjugation::get_verbs,
            commands::conjugation::log_conjugation_session,
            commands::speech::get_whisper_models,
            commands::speech::download_whisper_model,
            commands::speech::delete_whisper_model,
            commands::speech::transcribe_audio,
            commands::download::get_available_dictionaries,
            commands::download::download_dictionary,
            commands::favorites::toggle_favorite,
            commands::favorites::get_favorites,
            commands::favorites::is_favorite,
            commands::chat::get_chat_history,
            commands::chat::save_chat_message,
            commands::chat::clear_chat_history,
            commands::stats::get_daily_stats,
            commands::stats::get_overview_stats,
            commands::stats::log_error,
            commands::stats::get_frequent_errors,
            commands::stats::add_custom_word,
            commands::stats::get_random_word,
            commands::stats::export_progress,
            commands::stats::import_progress,
            log_session,
            clear_cache,
            reset_progress,
            detect_ollama,
            fetch_model_catalog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn log_session(
    state: tauri::State<'_, DbState>,
    base_dir: tauri::State<'_, BaseDirState>,
    pair_id: i64,
    session_type: String,
    session_data: serde_json::Value,
) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO sessions (language_pair_id, session_type, session_data) VALUES (?1, ?2, ?3)",
        rusqlite::params![pair_id, session_type, session_data.to_string()],
    )
    .map_err(|e| e.to_string())?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let time = chrono::Local::now().format("%H:%M").to_string();
    let session_file = base_dir.0.join(format!("memory/sessions/{}.md", today));
    let mut content = std::fs::read_to_string(&session_file)
        .unwrap_or_else(|_| format!("# Session {}\n\n", today));
    content.push_str(&format!("\n## {} — {}\n", time, session_type));
    if let Some(obj) = session_data.as_object() {
        for (key, val) in obj {
            content.push_str(&format!("- {} : {}\n", key, val));
        }
    }
    let _ = std::fs::write(&session_file, content);
    Ok(())
}

/// Clear downloaded models and dictionary caches
#[tauri::command]
fn clear_cache(base_dir: tauri::State<'_, BaseDirState>) -> Result<String, String> {
    let mut freed = 0u64;

    // Clear whisper models
    let models_dir = base_dir.0.join("models");
    if models_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for e in entries.flatten() {
                freed += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
        let _ = std::fs::remove_dir_all(&models_dir);
    }

    // Clear downloaded dictionaries
    let downloads_dir = base_dir.0.join("downloads");
    if downloads_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&downloads_dir) {
            for e in entries.flatten() {
                freed += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
        let _ = std::fs::remove_dir_all(&downloads_dir);
    }

    Ok(format!("{:.1} MB freed", freed as f64 / 1_000_000.0))
}

/// Reset all learning progress (keeps dictionaries)
#[tauri::command]
fn reset_progress(
    state: tauri::State<'_, DbState>,
    base_dir: tauri::State<'_, BaseDirState>,
) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Reset SRS cards
    db.execute("DELETE FROM srs_cards", []).map_err(|e| e.to_string())?;
    // Reset grammar progress
    db.execute("DELETE FROM grammar_progress", []).map_err(|e| e.to_string())?;
    // Reset sessions
    db.execute("DELETE FROM sessions", []).map_err(|e| e.to_string())?;
    // Reset errors
    db.execute("DELETE FROM errors", []).map_err(|e| e.to_string())?;
    // Reset settings
    db.execute(
        "UPDATE settings SET streak = 0, last_session_date = NULL, start_date = NULL WHERE id = 1",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Reset memory files
    let memory_dir = base_dir.0.join("memory");
    let _ = std::fs::write(memory_dir.join("progress.md"), "# Omnilingo Progress\n\n## Overview\n- **Words learned:** 0\n");
    let _ = std::fs::write(memory_dir.join("vocabulary.md"), "# Learned Vocabulary\n\n| Source | Target | Gender | Level | EF | Interval | Next Review | Score |\n|---|---|---|---|---|---|---|---|\n");
    let _ = std::fs::write(memory_dir.join("grammar-log.md"), "# Grammar Log\n\n");
    let _ = std::fs::write(memory_dir.join("conjugation-log.md"), "# Conjugation Log\n\n");
    let _ = std::fs::write(memory_dir.join("errors.md"), "# Frequent Errors\n\n## Vocabulary\n| Date | Word | Error | Correction |\n|---|---|---|---|\n");

    // Clear session files
    let sessions_dir = memory_dir.join("sessions");
    if sessions_dir.exists() {
        let _ = std::fs::remove_dir_all(&sessions_dir);
        let _ = std::fs::create_dir_all(&sessions_dir);
    }

    Ok("Progress reset".to_string())
}

/// Detect if Ollama is running locally and list available models
#[tauri::command]
async fn detect_ollama() -> Result<serde_json::Value, String> {
    // Ollama is a desktop-only local service
    #[cfg(mobile)]
    {
        return Ok(serde_json::json!({
            "available": false,
            "models": [],
        }));
    }

    #[cfg(not(mobile))]
    {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .map_err(|e| e.to_string())?;

        match client.get("http://localhost:11434/api/tags").send().await {
            Ok(resp) if resp.status().is_success() => {
                let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                let models: Vec<String> = json["models"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                    .collect();
                Ok(serde_json::json!({
                    "available": true,
                    "models": models,
                }))
            }
            _ => Ok(serde_json::json!({
                "available": false,
                "models": [],
            })),
        }
    }
}

/// Fetch model catalog from models.dev
#[tauri::command]
async fn fetch_model_catalog() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://models.dev/api.json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch model catalog: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Model catalog HTTP {}", resp.status()));
    }

    let catalog: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    // Extract only the providers we support
    let providers = ["anthropic", "openai", "mistral", "google-ai-studio"];
    let mut result = serde_json::Map::new();

    for provider in &providers {
        if let Some(p) = catalog.get(*provider) {
            if let Some(models) = p.get("models").and_then(|m| m.as_object()) {
                let model_ids: Vec<String> = models.keys().cloned().collect();
                result.insert(provider.to_string(), serde_json::json!(model_ids));
            }
        }
    }

    Ok(serde_json::Value::Object(result))
}
