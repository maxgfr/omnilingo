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
    pub tags: Option<String>,
    pub example_source: Option<String>,
    pub example_target: Option<String>,
}

#[derive(Serialize)]
pub struct FavoriteList {
    pub id: i64,
    pub name: String,
    pub language_pair_id: i64,
    pub item_count: i64,
    pub created_at: String,
}

fn row_to_favorite(row: &rusqlite::Row) -> rusqlite::Result<FavoriteWord> {
    Ok(FavoriteWord {
        id: row.get(0)?,
        word_id: row.get(1)?,
        source_word: row.get(2)?,
        target_word: row.get(3)?,
        gender: row.get(4)?,
        level: row.get(5)?,
        category: row.get(6)?,
        tags: row.get(7)?,
        example_source: row.get(8)?,
        example_target: row.get(9)?,
    })
}

const FAVORITE_SELECT: &str =
    "f.id, f.word_id, w.source_word, w.target_word, w.gender, w.level, w.category, w.tags, w.example_source, w.example_target";

#[tauri::command]
pub fn toggle_favorite(state: State<'_, DbState>, word_id: i64) -> Result<bool, String> {
    let db = state.db();

    let exists: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM favorites WHERE word_id = ?1",
            [word_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if exists {
        // Also remove from any favorite lists
        db.execute("DELETE FROM favorite_list_items WHERE word_id = ?1", [word_id])
            .map_err(|e| e.to_string())?;
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
    let db = state.db();
    let sql = format!(
        "SELECT {} FROM favorites f JOIN words w ON w.id = f.word_id WHERE f.language_pair_id = ?1 ORDER BY f.created_at DESC",
        FAVORITE_SELECT
    );
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let result = stmt
        .query_map([pair_id], row_to_favorite)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn is_favorite(state: State<'_, DbState>, word_id: i64) -> Result<bool, String> {
    let db = state.db();
    db.query_row(
        "SELECT COUNT(*) > 0 FROM favorites WHERE word_id = ?1",
        [word_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

// ── Favorite Lists ──────────────────────────────────────────────────

#[tauri::command]
pub fn create_favorite_list(state: State<'_, DbState>, name: String, pair_id: i64) -> Result<FavoriteList, String> {
    let db = state.db();
    db.execute(
        "INSERT INTO favorite_lists (name, language_pair_id) VALUES (?1, ?2)",
        rusqlite::params![name, pair_id],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();
    let created_at: String = db
        .query_row("SELECT created_at FROM favorite_lists WHERE id = ?1", [id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(FavoriteList {
        id,
        name,
        language_pair_id: pair_id,
        item_count: 0,
        created_at,
    })
}

#[tauri::command]
pub fn delete_favorite_list(state: State<'_, DbState>, list_id: i64) -> Result<(), String> {
    let db = state.db();
    // Items are cascade-deleted by FK
    db.execute("DELETE FROM favorite_lists WHERE id = ?1", [list_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_favorite_lists(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<FavoriteList>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT fl.id, fl.name, fl.language_pair_id, fl.created_at,
                    (SELECT COUNT(*) FROM favorite_list_items fli WHERE fli.list_id = fl.id) as item_count
             FROM favorite_lists fl
             WHERE fl.language_pair_id = ?1
             ORDER BY fl.created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map([pair_id], |row| {
            Ok(FavoriteList {
                id: row.get(0)?,
                name: row.get(1)?,
                language_pair_id: row.get(2)?,
                created_at: row.get(3)?,
                item_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn add_to_favorite_list(state: State<'_, DbState>, list_id: i64, word_id: i64) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "INSERT OR IGNORE INTO favorite_list_items (list_id, word_id) VALUES (?1, ?2)",
        rusqlite::params![list_id, word_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_from_favorite_list(state: State<'_, DbState>, list_id: i64, word_id: i64) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM favorite_list_items WHERE list_id = ?1 AND word_id = ?2",
        rusqlite::params![list_id, word_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_favorite_list(state: State<'_, DbState>, list_id: i64, name: String) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "UPDATE favorite_lists SET name = ?1 WHERE id = ?2",
        rusqlite::params![name, list_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_word_list_memberships(state: State<'_, DbState>, word_id: i64, pair_id: i64) -> Result<Vec<i64>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT fli.list_id FROM favorite_list_items fli
             JOIN favorite_lists fl ON fl.id = fli.list_id
             WHERE fli.word_id = ?1 AND fl.language_pair_id = ?2",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map(rusqlite::params![word_id, pair_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn get_favorite_list_items(state: State<'_, DbState>, list_id: i64) -> Result<Vec<FavoriteWord>, String> {
    let db = state.db();
    let sql = format!(
        "SELECT {} FROM favorite_list_items fli
         JOIN favorites f ON f.word_id = fli.word_id
         JOIN words w ON w.id = f.word_id
         WHERE fli.list_id = ?1
         ORDER BY fli.created_at DESC",
        FAVORITE_SELECT
    );
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let result = stmt
        .query_map([list_id], row_to_favorite)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}
