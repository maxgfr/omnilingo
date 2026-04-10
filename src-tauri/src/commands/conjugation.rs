use serde::Deserialize;
use tauri::State;

use crate::DbState;

#[derive(Deserialize)]
pub struct SaveVerbInput {
    pub pair_id: i64,
    pub infinitive: String,
    pub translation: String,
    pub level: Option<String>,
    pub verb_type: Option<String>,
    pub auxiliary: Option<String>,
    pub is_separable: bool,
    pub conjugations: serde_json::Value,
    pub examples: Option<serde_json::Value>,
}

#[tauri::command]
pub fn save_verb(state: State<'_, DbState>, input: SaveVerbInput) -> Result<i64, String> {
    let db = state.db();
    // UPSERT on the (language_pair_id, infinitive) UNIQUE constraint:
    // re-saving the same verb (e.g. after regenerating its conjugations
    // with the AI) overwrites the row instead of failing silently with a
    // constraint error. We RETURNING the id so the new or existing row's
    // id flows back to the UI in a single round-trip.
    let id: i64 = db
        .query_row(
            "INSERT INTO verbs (language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(language_pair_id, infinitive) DO UPDATE SET
                translation = excluded.translation,
                level = excluded.level,
                verb_type = excluded.verb_type,
                auxiliary = excluded.auxiliary,
                is_separable = excluded.is_separable,
                conjugations = excluded.conjugations,
                examples = excluded.examples
             RETURNING id",
            rusqlite::params![
                input.pair_id,
                input.infinitive,
                input.translation,
                input.level,
                input.verb_type,
                input.auxiliary,
                if input.is_separable { 1i64 } else { 0i64 },
                input.conjugations.to_string(),
                input.examples.map(|e| e.to_string()),
            ],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(id)
}
