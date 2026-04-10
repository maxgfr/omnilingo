use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::DbState;

/// Ensure the settings row exists (no hardcoded language pair -- onboarding handles that)
pub fn ensure_settings_exist(conn: &Connection) -> Result<(), String> {
    conn.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct Settings {
    pub active_language_pair_id: Option<i64>,
    pub dark_mode: String,
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
    let db = state.db();
    read_settings_from_db(&db)
}

#[tauri::command]
pub fn update_setting(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let db = state.db();
    let allowed = [
        "dark_mode", "active_language_pair_id",
        "ai_provider", "ai_api_key", "ai_model",
    ];
    if !allowed.contains(&key.as_str()) {
        return Err(format!("Invalid setting key: {}", key));
    }
    let sql = format!("UPDATE settings SET {} = ?1 WHERE id = 1", key);
    db.execute(&sql, [&value])
        .map_err(|e| format!("Failed to update setting: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_language_pairs(state: State<'_, DbState>) -> Result<Vec<LanguagePair>, String> {
    let db = state.db();
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
    let db = state.db();
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
pub fn delete_language_pair(state: State<'_, DbState>, pair_id: i64) -> Result<(), String> {
    let db = state.db();
    // Clear active pair reference in settings first
    db.execute(
        "UPDATE settings SET active_language_pair_id = NULL WHERE active_language_pair_id = ?1",
        [pair_id],
    ).map_err(|e| e.to_string())?;
    // Delete all related data (manual cascade — all tables referencing language_pairs)
    for sql in &[
        "DELETE FROM favorites WHERE word_id IN (SELECT id FROM words WHERE language_pair_id = ?1)",
        "DELETE FROM words WHERE language_pair_id = ?1",
        "DELETE FROM grammar_progress WHERE topic_id IN (SELECT id FROM grammar_topics WHERE language_pair_id = ?1)",
        "DELETE FROM grammar_srs WHERE language_pair_id = ?1",
        "DELETE FROM grammar_topics WHERE language_pair_id = ?1",
        "DELETE FROM verbs WHERE language_pair_id = ?1",
        "DELETE FROM dictionary_packs WHERE language_pair_id = ?1",
        "DELETE FROM sessions WHERE language_pair_id = ?1",
        "DELETE FROM errors WHERE language_pair_id = ?1",
        "DELETE FROM chat_messages WHERE language_pair_id = ?1",
        "DELETE FROM conversation_sessions WHERE language_pair_id = ?1",
        "DELETE FROM conversation_scenarios WHERE language_pair_id = ?1",
        "DELETE FROM language_pairs WHERE id = ?1",
    ] {
        db.execute(sql, [pair_id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn read_settings_from_db(db: &rusqlite::Connection) -> Result<Settings, String> {
    db.query_row(
        "SELECT active_language_pair_id, dark_mode,
                COALESCE(ai_provider, 'anthropic'), COALESCE(ai_model, '')
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                active_language_pair_id: row.get(0)?,
                dark_mode: {
                    let raw: rusqlite::types::Value = row.get(1)?;
                    match raw {
                        rusqlite::types::Value::Text(s) => s,
                        rusqlite::types::Value::Integer(i) => if i != 0 { "dark".to_string() } else { "light".to_string() },
                        _ => "system".to_string(),
                    }
                },
                ai_provider: row.get(2)?,
                ai_model: row.get(3)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get settings: {}", e))
}
