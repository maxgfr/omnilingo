use serde::{Deserialize, Serialize};
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

#[derive(Serialize)]
pub struct Verb {
    pub id: i64,
    pub language_pair_id: i64,
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

#[tauri::command]
pub fn get_verbs(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<Verb>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, infinitive, translation, level, verb_type, auxiliary,
                    is_separable, conjugations, examples
             FROM verbs
             WHERE language_pair_id = ?1
             ORDER BY infinitive COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let verbs = stmt
        .query_map([pair_id], |row| {
            let conjugations_str: String = row.get(8)?;
            let examples_str: Option<String> = row.get(9)?;
            Ok(Verb {
                id: row.get(0)?,
                language_pair_id: row.get(1)?,
                infinitive: row.get(2)?,
                translation: row.get(3)?,
                level: row.get(4)?,
                verb_type: row.get(5)?,
                auxiliary: row.get(6)?,
                is_separable: row.get::<_, i64>(7)? != 0,
                conjugations: serde_json::from_str(&conjugations_str)
                    .unwrap_or(serde_json::Value::Object(Default::default())),
                examples: examples_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(verbs)
}

#[tauri::command]
pub fn delete_verb(state: State<'_, DbState>, verb_id: i64, pair_id: i64) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM verbs WHERE id = ?1 AND language_pair_id = ?2",
        rusqlite::params![verb_id, pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
