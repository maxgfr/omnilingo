use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize)]
pub struct ConversationScenario {
    pub id: i64,
    pub language_pair_id: i64,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub system_prompt: String,
    pub is_builtin: bool,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct ConversationSession {
    pub id: i64,
    pub language_pair_id: i64,
    pub scenario_id: Option<i64>,
    pub mode: String,
    pub title: String,
    pub messages: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_conversation_scenarios(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<Vec<ConversationScenario>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, name, icon, description, system_prompt, is_builtin, created_at
             FROM conversation_scenarios
             WHERE language_pair_id = ?1
             ORDER BY is_builtin DESC, name",
        )
        .map_err(|e| e.to_string())?;

    let scenarios = stmt
        .query_map([pair_id], |row| {
            Ok(ConversationScenario {
                id: row.get(0)?,
                language_pair_id: row.get(1)?,
                name: row.get(2)?,
                icon: row.get(3)?,
                description: row.get(4)?,
                system_prompt: row.get(5)?,
                is_builtin: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(scenarios)
}

#[tauri::command]
pub fn save_conversation_scenario(
    state: State<'_, DbState>,
    pair_id: i64,
    name: String,
    icon: String,
    description: String,
    system_prompt: String,
) -> Result<i64, String> {
    let db = state.db();
    db.execute(
        "INSERT INTO conversation_scenarios (language_pair_id, name, icon, description, system_prompt, is_builtin)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![pair_id, name, icon, description, system_prompt],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn delete_conversation_scenario(
    state: State<'_, DbState>,
    scenario_id: i64,
) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM conversation_scenarios WHERE id = ?1 AND is_builtin = 0",
        [scenario_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_conversation_sessions(
    state: State<'_, DbState>,
    pair_id: i64,
    limit: Option<i64>,
) -> Result<Vec<ConversationSession>, String> {
    let db = state.db();
    let limit = limit.unwrap_or(50);
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, scenario_id, mode, title, messages, created_at
             FROM conversation_sessions
             WHERE language_pair_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map(rusqlite::params![pair_id, limit], |row| {
            Ok(ConversationSession {
                id: row.get(0)?,
                language_pair_id: row.get(1)?,
                scenario_id: row.get(2)?,
                mode: row.get(3)?,
                title: row.get(4)?,
                messages: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(sessions)
}

#[tauri::command]
pub fn save_conversation_session(
    state: State<'_, DbState>,
    pair_id: i64,
    scenario_id: Option<i64>,
    mode: String,
    title: String,
    messages: String,
) -> Result<i64, String> {
    let db = state.db();
    db.execute(
        "INSERT INTO conversation_sessions (language_pair_id, scenario_id, mode, title, messages)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![pair_id, scenario_id, mode, title, messages],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn delete_conversation_session(
    state: State<'_, DbState>,
    session_id: i64,
) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM conversation_sessions WHERE id = ?1",
        [session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
