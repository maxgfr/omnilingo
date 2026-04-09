use serde::Serialize;
use tauri::State;

use crate::DbState;

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

/// Export all user data as JSON
#[tauri::command]
pub fn export_data(state: State<'_, DbState>) -> Result<String, String> {
    let db = state.db();

    let mut export = serde_json::Map::new();

    // Export language pairs
    {
        let mut stmt = db.prepare("SELECT id, source_lang, target_lang, source_name, target_name FROM language_pairs").map_err(|e| e.to_string())?;
        let pairs: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "source_lang": row.get::<_, String>(1)?,
                "target_lang": row.get::<_, String>(2)?,
                "source_name": row.get::<_, String>(3)?,
                "target_name": row.get::<_, String>(4)?,
            }))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        export.insert("language_pairs".into(), serde_json::Value::Array(pairs));
    }

    // Export words
    {
        let mut stmt = db.prepare(
            "SELECT language_pair_id, source_word, target_word, gender, level, category FROM words"
        ).map_err(|e| e.to_string())?;
        let words: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "language_pair_id": row.get::<_, i64>(0)?,
                "source_word": row.get::<_, String>(1)?,
                "target_word": row.get::<_, String>(2)?,
                "gender": row.get::<_, Option<String>>(3)?,
                "level": row.get::<_, Option<String>>(4)?,
                "category": row.get::<_, Option<String>>(5)?,
            }))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        export.insert("words".into(), serde_json::Value::Array(words));
    }

    // Export favorites
    {
        let mut stmt = db.prepare(
            "SELECT f.word_id, w.source_word, w.target_word, w.language_pair_id
             FROM favorites f JOIN words w ON w.id = f.word_id"
        ).map_err(|e| e.to_string())?;
        let favs: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "word_id": row.get::<_, i64>(0)?,
                "source_word": row.get::<_, String>(1)?,
                "target_word": row.get::<_, String>(2)?,
                "language_pair_id": row.get::<_, i64>(3)?,
            }))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        export.insert("favorites".into(), serde_json::Value::Array(favs));
    }

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
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
