use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize)]
pub struct FavoriteWord {
    pub id: i64,
    pub word_id: i64,
    pub source_word: String,
    pub target_word: String,
    pub gender: Option<String>,
    pub level: Option<String>,
    pub category: Option<String>,
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, DbState>, word_id: i64) -> Result<bool, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let exists: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM favorites WHERE word_id = ?1",
            [word_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if exists {
        db.execute("DELETE FROM favorites WHERE word_id = ?1", [word_id])
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        let pair_id: i64 = db
            .query_row(
                "SELECT language_pair_id FROM words WHERE id = ?1",
                [word_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR IGNORE INTO favorites (word_id, language_pair_id) VALUES (?1, ?2)",
            rusqlite::params![word_id, pair_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn get_favorites(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<FavoriteWord>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT f.id, f.word_id, w.source_word, w.target_word, w.gender, w.level, w.category
             FROM favorites f
             JOIN words w ON w.id = f.word_id
             WHERE f.language_pair_id = ?1
             ORDER BY f.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map([pair_id], |row| {
            Ok(FavoriteWord {
                id: row.get(0)?,
                word_id: row.get(1)?,
                source_word: row.get(2)?,
                target_word: row.get(3)?,
                gender: row.get(4)?,
                level: row.get(5)?,
                category: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn is_favorite(state: State<'_, DbState>, word_id: i64) -> Result<bool, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT COUNT(*) > 0 FROM favorites WHERE word_id = ?1",
        [word_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}
