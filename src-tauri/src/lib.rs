use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;

pub struct DbState(pub Mutex<rusqlite::Connection>);
pub struct BaseDirState(pub PathBuf);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let base_dir = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .expect("Failed to get project root")
                    .to_path_buf()
            } else {
                app.path()
                    .resource_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
            };

            let _ = std::fs::create_dir_all(base_dir.join("memory/sessions"));
            let _ = std::fs::create_dir_all(base_dir.join("exercises"));

            let conn = db::init_database(&base_dir).expect("Failed to init DB");
            commands::import::auto_import_builtin(&conn, &base_dir)
                .expect("Failed to import builtin data");

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
            commands::ai::get_ai_settings_cmd,
            commands::ai::set_ai_provider,
            commands::import::import_builtin_data,
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
            commands::speech::transcribe_audio,
            commands::download::get_available_dictionaries,
            commands::download::download_dictionary,
            log_session,
            clear_cache,
            reset_progress,
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
        .unwrap_or_else(|_| format!("# Session du {}\n\n", today));
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
        for entry in std::fs::read_dir(&models_dir).unwrap_or_else(|_| std::fs::read_dir(".").unwrap()) {
            if let Ok(e) = entry {
                freed += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
        let _ = std::fs::remove_dir_all(&models_dir);
    }

    // Clear downloaded dictionaries
    let downloads_dir = base_dir.0.join("downloads");
    if downloads_dir.exists() {
        for entry in std::fs::read_dir(&downloads_dir).unwrap_or_else(|_| std::fs::read_dir(".").unwrap()) {
            if let Ok(e) = entry {
                freed += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
        let _ = std::fs::remove_dir_all(&downloads_dir);
    }

    Ok(format!("{:.1} MB libérés", freed as f64 / 1_000_000.0))
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
    let _ = std::fs::write(memory_dir.join("progress.md"), "# Progression Omnilingo\n\n## Vue d'ensemble\n- **Mots appris :** 0\n");
    let _ = std::fs::write(memory_dir.join("vocabulary.md"), "# Vocabulaire appris\n\n| Mot | Traduction | Genre | Niveau | EF | Intervalle | Prochaine révision | Score |\n|---|---|---|---|---|---|---|---|\n");
    let _ = std::fs::write(memory_dir.join("grammar-log.md"), "# Journal de grammaire\n\n");
    let _ = std::fs::write(memory_dir.join("conjugation-log.md"), "# Journal de conjugaison\n\n");
    let _ = std::fs::write(memory_dir.join("errors.md"), "# Erreurs fréquentes\n\n## Vocabulaire\n| Date | Mot | Erreur | Correction |\n|---|---|---|---|\n");

    // Clear session files
    let sessions_dir = memory_dir.join("sessions");
    if sessions_dir.exists() {
        let _ = std::fs::remove_dir_all(&sessions_dir);
        let _ = std::fs::create_dir_all(&sessions_dir);
    }

    Ok("Progression réinitialisée".to_string())
}
