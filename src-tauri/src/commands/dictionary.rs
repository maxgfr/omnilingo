use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize, Clone)]
pub struct Word {
    pub id: i64,
    pub language_pair_id: i64,
    pub source_word: String,
    pub target_word: String,
    pub gender: Option<String>,
    pub plural: Option<String>,
    pub level: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub example_source: Option<String>,
    pub example_target: Option<String>,
}

fn row_to_word(row: &rusqlite::Row<'_>) -> rusqlite::Result<Word> {
    Ok(Word {
        id: row.get(0)?,
        language_pair_id: row.get(1)?,
        source_word: row.get(2)?,
        target_word: row.get(3)?,
        gender: row.get(4)?,
        plural: row.get(5)?,
        level: row.get(6)?,
        category: row.get(7)?,
        tags: row.get(8)?,
        example_source: row.get(9)?,
        example_target: row.get(10)?,
    })
}

#[tauri::command]
pub fn get_words(
    state: State<'_, DbState>,
    pair_id: i64,
    level: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Word>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    if let Some(lvl) = level {
        let mut stmt = db
            .prepare(
                "SELECT id, language_pair_id, source_word, target_word, gender, plural, level, category, tags, example_source, example_target
                 FROM words WHERE language_pair_id = ?1 AND level = ?2
                 ORDER BY source_word LIMIT ?3 OFFSET ?4",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![pair_id, lvl, limit, offset], row_to_word)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    } else {
        let mut stmt = db
            .prepare(
                "SELECT id, language_pair_id, source_word, target_word, gender, plural, level, category, tags, example_source, example_target
                 FROM words WHERE language_pair_id = ?1
                 ORDER BY source_word LIMIT ?2 OFFSET ?3",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![pair_id, limit, offset], row_to_word)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }
}

#[tauri::command]
pub fn search_words(
    state: State<'_, DbState>,
    pair_id: i64,
    query: String,
    level: Option<String>,
    category: Option<String>,
) -> Result<Vec<Word>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Try FTS5 first, fall back to LIKE
    let fts_query = format!("{}*", query.replace('"', ""));
    let pattern = format!("%{}%", query);

    let mut sql = String::from(
        "SELECT w.id, w.language_pair_id, w.source_word, w.target_word, w.gender, w.plural, w.level, w.category, w.tags, w.example_source, w.example_target
         FROM words w
         LEFT JOIN words_fts fts ON fts.rowid = w.id
         WHERE w.language_pair_id = ?1 AND (fts.words_fts MATCH ?2 OR w.source_word LIKE ?3 OR w.target_word LIKE ?3)",
    );
    let mut param_values: Vec<String> = vec![pair_id.to_string(), fts_query, pattern];

    if let Some(ref lvl) = level {
        sql.push_str(&format!(" AND level = ?{}", param_values.len() + 1));
        param_values.push(lvl.clone());
    }
    if let Some(ref cat) = category {
        sql.push_str(&format!(" AND category = ?{}", param_values.len() + 1));
        param_values.push(cat.clone());
    }

    sql.push_str(" ORDER BY source_word LIMIT 100");

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
    let result = stmt
        .query_map(params.as_slice(), row_to_word)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn get_unlearned_words(
    state: State<'_, DbState>,
    pair_id: i64,
    level: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<Word>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(10);

    if let Some(lvl) = level {
        let levels = match lvl.as_str() {
            "A1" => "'A1'",
            "A2" => "'A1','A2'",
            _ => "'A1','A2','B1'",
        };
        let sql = format!(
            "SELECT w.id, w.language_pair_id, w.source_word, w.target_word, w.gender, w.plural, w.level, w.category, w.tags, w.example_source, w.example_target
             FROM words w
             LEFT JOIN srs_cards sc ON sc.word_id = w.id
             WHERE w.language_pair_id = ?1 AND sc.id IS NULL AND w.level IN ({})
             ORDER BY RANDOM() LIMIT ?2",
            levels
        );
        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![pair_id, limit], row_to_word)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    } else {
        let mut stmt = db
            .prepare(
                "SELECT w.id, w.language_pair_id, w.source_word, w.target_word, w.gender, w.plural, w.level, w.category, w.tags, w.example_source, w.example_target
                 FROM words w
                 LEFT JOIN srs_cards sc ON sc.word_id = w.id
                 WHERE w.language_pair_id = ?1 AND sc.id IS NULL
                 ORDER BY RANDOM() LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![pair_id, limit], row_to_word)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }
}

#[tauri::command]
pub fn get_word_count(state: State<'_, DbState>, pair_id: i64) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT COUNT(*) FROM words WHERE language_pair_id = ?1",
        [pair_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_categories(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<String>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT DISTINCT category FROM words WHERE language_pair_id = ?1 AND category IS NOT NULL ORDER BY category",
        )
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([pair_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}
