use serde::Serialize;
use tauri::State;

use crate::{DbState, BaseDirState};

#[derive(Serialize)]
pub struct Settings {
    pub active_language_pair_id: Option<i64>,
    pub level: String,
    pub words_per_day: i64,
    pub streak: i64,
    pub last_session_date: Option<String>,
    pub start_date: Option<String>,
    pub dark_mode: String,
    pub audio_enabled: bool,
    pub ai_provider: String,
    pub ai_model: String,
}

#[derive(Serialize)]
pub struct LanguagePair {
    pub id: i64,
    pub source_lang: String,
    pub target_lang: String,
    pub source_name: String,
    pub target_name: String,
    pub source_flag: String,
    pub target_flag: String,
    pub is_active: bool,
}

#[tauri::command]
pub fn get_settings(state: State<'_, DbState>) -> Result<Settings, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    read_settings_from_db(&db)
}

#[tauri::command]
pub fn update_setting(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let allowed = [
        "level", "words_per_day", "streak", "last_session_date",
        "start_date", "dark_mode", "audio_enabled", "active_language_pair_id",
        "ai_provider", "ai_api_key", "ai_model",
    ];
    if !allowed.contains(&key.as_str()) {
        return Err(format!("Invalid setting key: {}", key));
    }
    // Use parameterized column name (safe because we validated against allowlist)
    let sql = format!("UPDATE settings SET {} = ?1 WHERE id = 1", key);
    db.execute(&sql, [&value])
        .map_err(|e| format!("Failed to update setting: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_language_pairs(state: State<'_, DbState>) -> Result<Vec<LanguagePair>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, source_lang, target_lang, source_name, target_name,
                    source_flag, target_flag, is_active
             FROM language_pairs ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let pairs = stmt
        .query_map([], |row| {
            Ok(LanguagePair {
                id: row.get(0)?,
                source_lang: row.get(1)?,
                target_lang: row.get(2)?,
                source_name: row.get(3)?,
                target_name: row.get(4)?,
                source_flag: row.get(5)?,
                target_flag: row.get(6)?,
                is_active: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(pairs)
}

#[tauri::command]
pub fn set_active_language_pair(state: State<'_, DbState>, pair_id: i64) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE language_pairs SET is_active = 0", [])
        .map_err(|e| e.to_string())?;
    db.execute("UPDATE language_pairs SET is_active = 1 WHERE id = ?1", [pair_id])
        .map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE settings SET active_language_pair_id = ?1 WHERE id = 1",
        [pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_streak(state: State<'_, DbState>, base_dir: State<'_, BaseDirState>) -> Result<Settings, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let (streak, last_session): (i64, Option<String>) = db
        .query_row(
            "SELECT streak, last_session_date FROM settings WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let new_streak = match &last_session {
        Some(last) if last == &today => streak, // Already counted today
        Some(last) => {
            let last_date = chrono::NaiveDate::parse_from_str(last, "%Y-%m-%d")
                .unwrap_or_else(|_| chrono::Local::now().date_naive());
            let today_date = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d")
                .unwrap_or_else(|_| chrono::Local::now().date_naive());
            let diff = (today_date - last_date).num_days();
            if diff == 1 { streak + 1 } else if diff > 1 { 1 } else { streak }
        }
        None => 1,
    };

    db.execute(
        "UPDATE settings SET streak = ?1, last_session_date = ?2 WHERE id = 1",
        rusqlite::params![new_streak, &today],
    )
    .map_err(|e| e.to_string())?;

    // Set start_date if not set
    db.execute(
        "UPDATE settings SET start_date = ?1 WHERE id = 1 AND start_date IS NULL",
        [&today],
    )
    .map_err(|e| e.to_string())?;

    // Persist progress to markdown and return settings, all under the same lock
    let _ = persist_progress_inner(&db, &base_dir.0);

    let settings = read_settings_from_db(&db)?;

    Ok(settings)
}

fn read_settings_from_db(db: &rusqlite::Connection) -> Result<Settings, String> {
    db.query_row(
        "SELECT active_language_pair_id, level, words_per_day, streak,
                last_session_date, start_date, dark_mode, audio_enabled,
                COALESCE(ai_provider, 'anthropic'), COALESCE(ai_model, '')
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                active_language_pair_id: row.get(0)?,
                level: row.get(1)?,
                words_per_day: row.get(2)?,
                streak: row.get(3)?,
                last_session_date: row.get(4)?,
                start_date: row.get(5)?,
                dark_mode: {
                    let raw: rusqlite::types::Value = row.get(6)?;
                    match raw {
                        rusqlite::types::Value::Text(s) => s,
                        rusqlite::types::Value::Integer(i) => if i != 0 { "dark".to_string() } else { "light".to_string() },
                        _ => "system".to_string(),
                    }
                },
                audio_enabled: row.get::<_, i64>(7)? != 0,
                ai_provider: row.get(8)?,
                ai_model: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get settings: {}", e))
}

fn persist_progress_inner(db: &rusqlite::Connection, base_dir: &std::path::Path) -> Result<(), String> {
    let settings = read_settings_from_db(db)?;

    let pair_id = settings.active_language_pair_id.unwrap_or(1);
    let total_learned: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let due_count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1 AND next_review <= date('now')",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let grammar_completed: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM grammar_progress WHERE language_pair_id = ?1 AND completed = 1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let grammar_total: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM grammar_topics WHERE language_pair_id = ?1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(36);

    let accuracy = crate::commands::srs::compute_accuracy(db, pair_id);

    let md = format!(
        "# Omnilingo Progress\n\n\
         ## Overview\n\
         - **Current level:** {}\n\
         - **Started:** {}\n\
         - **Words learned:** {}\n\
         - **Words due:** {}\n\
         - **Grammar completed:** {}/{}\n\
         - **Streak:** {} days\n\
         - **Last session:** {}\n\
         - **Words per day:** {}\n\
         - **Average accuracy:** {}%\n",
        settings.level,
        settings.start_date.as_deref().unwrap_or("—"),
        total_learned,
        due_count,
        grammar_completed,
        grammar_total,
        settings.streak,
        settings.last_session_date.as_deref().unwrap_or("never"),
        settings.words_per_day,
        accuracy,
    );

    let memory_dir = base_dir.join("memory");
    let _ = std::fs::write(memory_dir.join("progress.md"), md);
    Ok(())
}
