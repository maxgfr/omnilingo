use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;

pub struct DbState(pub Mutex<rusqlite::Connection>);
pub struct BaseDirState(pub PathBuf);

impl DbState {
    /// Acquire the DB lock, recovering from a poisoned mutex if a previous holder panicked.
    pub fn db(&self) -> std::sync::MutexGuard<'_, rusqlite::Connection> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init());

    if !cfg!(debug_assertions) {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
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

            // Persistent per-user data dir.
            //
            // Release builds MUST use `app_data_dir()` (e.g. on macOS:
            // ~/Library/Application Support/com.omnilingo.app). Earlier
            // versions used `resource_dir()`, which on macOS lives inside
            // the read-only `.app` bundle and gets wiped every time the
            // user installs an update — destroying the SQLite DB and the
            // memory/ files.
            let base_dir = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .expect("Failed to get project root")
                    .to_path_buf()
            } else {
                let dir = app
                    .path()
                    .app_data_dir()
                    .expect("Failed to resolve app data dir");
                std::fs::create_dir_all(&dir)
                    .expect("Failed to create app data dir");
                dir
            };

            let _ = std::fs::create_dir_all(base_dir.join("memory/sessions"));
            let _ = std::fs::create_dir_all(base_dir.join("exercises"));

            let conn = db::init_database(&base_dir).expect("Failed to init DB");
            commands::settings::ensure_settings_exist(&conn).ok();

            app.manage(DbState(Mutex::new(conn)));
            app.manage(BaseDirState(base_dir));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings::get_settings,
            commands::settings::update_setting,
            commands::settings::get_language_pairs,
            commands::settings::set_active_language_pair,
            commands::settings::create_language_pair,
            commands::settings::delete_language_pair,
            // Memory
            commands::memory::read_memory_file,
            // AI
            commands::ai::ask_ai,
            commands::ai::ask_ai_conversation,
            commands::ai::get_ai_settings_cmd,
            commands::ai::set_ai_provider,
            commands::ai::test_ai_connection,
            commands::ai::set_ai_custom_url,
            commands::ai::generate_vocabulary,
            commands::ai::generate_grammar,
            // Grammar
            commands::grammar::get_grammar_topics,
            commands::grammar::save_grammar_topic,
            commands::grammar::delete_grammar_topic,
            // Conjugation
            commands::conjugation::save_verb,
            commands::conjugation::get_verbs,
            commands::conjugation::delete_verb,
            // Dictionary (saved AI lookups)
            commands::dictionary::save_dictionary_entry,
            commands::dictionary::get_dictionary_entries,
            commands::dictionary::delete_dictionary_entry,
            // Chat
            commands::chat::get_chat_history,
            commands::chat::save_chat_message,
            commands::chat::clear_chat_history,
            // Conversation
            commands::conversation::get_conversation_scenarios,
            commands::conversation::save_conversation_scenario,
            commands::conversation::update_conversation_scenario,
            commands::conversation::delete_conversation_scenario,
            commands::conversation::get_conversation_sessions,
            commands::conversation::save_conversation_session,
            commands::conversation::delete_conversation_session,
            commands::conversation::update_conversation_session_title,
            // Global
            log_session,
            delete_all_data,
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
    let db = state.db();
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

/// Delete ALL data (progress, settings — everything except language pairs)
#[tauri::command]
fn delete_all_data(
    state: tauri::State<'_, DbState>,
    base_dir: tauri::State<'_, BaseDirState>,
) -> Result<String, String> {
    let db = state.db();

    // Delete in FK-safe order: children before parents
    db.execute("DELETE FROM dictionary_entries", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM grammar_progress", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM grammar_srs", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM grammar_topics", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM chat_messages", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM conversation_sessions", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM conversation_scenarios WHERE is_builtin = 0", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM daily_stats", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM errors", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM sessions", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM verbs", []).map_err(|e| e.to_string())?;
    db.execute("UPDATE settings SET active_language_pair_id = NULL", []).map_err(|e| e.to_string())?;
    db.execute("DELETE FROM language_pairs", []).map_err(|e| e.to_string())?;

    // Reset memory files
    let memory_dir = base_dir.0.join("memory");
    let _ = std::fs::write(memory_dir.join("progress.md"), "# Omnilingo Progress\n\n");
    let _ = std::fs::write(memory_dir.join("vocabulary.md"), "# Learned Vocabulary\n\n");
    let _ = std::fs::write(memory_dir.join("grammar-log.md"), "# Grammar Log\n\n");
    let _ = std::fs::write(memory_dir.join("conjugation-log.md"), "# Conjugation Log\n\n");
    let sessions_dir = memory_dir.join("sessions");
    if sessions_dir.exists() {
        let _ = std::fs::remove_dir_all(&sessions_dir);
        let _ = std::fs::create_dir_all(&sessions_dir);
    }

    Ok("All data deleted".to_string())
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
