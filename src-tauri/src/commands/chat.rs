use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize)]
pub struct ChatMessageRow {
    pub id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_chat_history(
    state: State<'_, DbState>,
    pair_id: i64,
    limit: Option<i64>,
) -> Result<Vec<ChatMessageRow>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);

    let mut stmt = db
        .prepare(
            "SELECT id, role, content, created_at FROM chat_messages
             WHERE language_pair_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![pair_id, limit], |row| {
            Ok(ChatMessageRow {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Reverse to get chronological order
    let mut result = rows;
    result.reverse();
    Ok(result)
}

#[tauri::command]
pub fn save_chat_message(
    state: State<'_, DbState>,
    pair_id: i64,
    role: String,
    content: String,
) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO chat_messages (language_pair_id, role, content) VALUES (?1, ?2, ?3)",
        rusqlite::params![pair_id, role, content],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn clear_chat_history(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM chat_messages WHERE language_pair_id = ?1",
        [pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
