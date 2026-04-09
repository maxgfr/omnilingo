use serde::Serialize;
use tauri::State;

use crate::db::normalize_for_search;
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
pub fn search_words(
    state: State<'_, DbState>,
    pair_id: i64,
    query: String,
    level: Option<String>,
    category: Option<String>,
    reverse_pair_id: Option<i64>,
) -> Result<Vec<Word>, String> {
    let db = state.db();

    // Normalize query: strip accents, lowercase (ü→u, é→e, ß→ss, etc.)
    let normalized = normalize_for_search(&query);
    let pattern = format!("%{}%", normalized);
    let prefix = format!("{}%", normalized);
    let exact = normalized;
    let effective_reverse = reverse_pair_id.unwrap_or(pair_id);

    // Use Value enum for correct type binding (Integer for IDs, Text for patterns)
    let mut param_values: Vec<rusqlite::types::Value> = vec![
        rusqlite::types::Value::Integer(pair_id),           // ?1
        rusqlite::types::Value::Text(pattern.clone()),      // ?2
        rusqlite::types::Value::Text(exact),                // ?3
        rusqlite::types::Value::Text(prefix),               // ?4
        rusqlite::types::Value::Text(pattern),              // ?5
        rusqlite::types::Value::Integer(effective_reverse),  // ?6
    ];

    let mut sql = String::from(
        "SELECT w.id, w.language_pair_id, w.source_word, w.target_word, w.gender, w.plural, w.level, w.category, w.tags, w.example_source, w.example_target
         FROM words w
         WHERE w.language_pair_id IN (?1, ?6) AND (unaccent(w.source_word) LIKE ?2 OR unaccent(w.target_word) LIKE ?2)",
    );

    if let Some(ref lvl) = level {
        sql.push_str(&format!(" AND level = ?{}", param_values.len() + 1));
        param_values.push(rusqlite::types::Value::Text(lvl.clone()));
    }
    if let Some(ref cat) = category {
        sql.push_str(&format!(" AND category = ?{}", param_values.len() + 1));
        param_values.push(rusqlite::types::Value::Text(cat.clone()));
    }

    // Order by relevance: exact > prefix > contains, source before target, shorter words first
    sql.push_str(
        " ORDER BY
           CASE WHEN w.language_pair_id = ?1 THEN 0 ELSE 1 END,
           CASE
             WHEN unaccent(w.source_word) = ?3 THEN 0
             WHEN unaccent(w.target_word) = ?3 THEN 1
             WHEN unaccent(w.source_word) LIKE ?4 THEN 2
             WHEN unaccent(w.target_word) LIKE ?4 THEN 3
             ELSE 4
           END,
           length(w.source_word),
           w.source_word
         LIMIT 100"
    );

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
    let result = stmt
        .query_map(params.as_slice(), row_to_word)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub fn get_all_dictionary_words(
    state: State<'_, DbState>,
    pair_id: i64,
    reverse_pair_id: Option<i64>,
) -> Result<Vec<Word>, String> {
    let db = state.db();
    let effective_reverse = reverse_pair_id.unwrap_or(pair_id);
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, source_word, target_word, gender, plural, level, category, tags, example_source, example_target
             FROM words WHERE language_pair_id IN (?1, ?2)
             ORDER BY source_word",
        )
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map(rusqlite::params![pair_id, effective_reverse], row_to_word)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}
