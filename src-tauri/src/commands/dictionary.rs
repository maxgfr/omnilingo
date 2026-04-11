use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize, Clone)]
pub struct DictionaryEntry {
    pub id: i64,
    pub language_pair_id: i64,
    pub query: String,
    pub content: String,
    pub created_at: String,
}

fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<DictionaryEntry> {
    Ok(DictionaryEntry {
        id: row.get(0)?,
        language_pair_id: row.get(1)?,
        query: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
    })
}

#[tauri::command]
pub fn save_dictionary_entry(
    state: State<'_, DbState>,
    pair_id: i64,
    query: String,
    content: String,
) -> Result<i64, String> {
    let db = state.db();
    // UPSERT on (language_pair_id, query) so re-saving the same word
    // overwrites the cached AI markdown instead of failing on the unique
    // constraint. RETURNING id flows the new or existing row id back in a
    // single round-trip.
    db.query_row(
        "INSERT INTO dictionary_entries (language_pair_id, query, content)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(language_pair_id, query) DO UPDATE SET
            content = excluded.content,
            created_at = datetime('now')
         RETURNING id",
        rusqlite::params![pair_id, query, content],
        |row| row.get(0),
    )
    .map_err(|e| format!("Failed to save dictionary entry: {}", e))
}

#[tauri::command]
pub fn get_dictionary_entries(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<Vec<DictionaryEntry>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, query, content, created_at
             FROM dictionary_entries
             WHERE language_pair_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map([pair_id], row_to_entry)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(entries)
}

#[tauri::command]
pub fn delete_dictionary_entry(
    state: State<'_, DbState>,
    entry_id: i64,
    pair_id: i64,
) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM dictionary_entries WHERE id = ?1 AND language_pair_id = ?2",
        rusqlite::params![entry_id, pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
