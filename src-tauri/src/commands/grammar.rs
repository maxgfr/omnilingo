use serde::{Serialize, Deserialize};
use tauri::State;

use crate::DbState;

#[derive(Serialize)]
pub struct GrammarTopic {
    pub id: String,
    pub language_pair_id: i64,
    pub level: String,
    pub display_order: i64,
    pub title: String,
    pub title_source: Option<String>,
    pub explanation: String,
    pub key_points: Option<serde_json::Value>,
    pub examples: Option<serde_json::Value>,
    pub exercises: Option<serde_json::Value>,
}

#[tauri::command]
pub fn get_grammar_topics(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<GrammarTopic>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT id, language_pair_id, level, display_order, title, title_source,
                    explanation, key_points, examples, exercises
             FROM grammar_topics
             WHERE language_pair_id = ?1
             ORDER BY level, display_order",
        )
        .map_err(|e| e.to_string())?;

    let topics = stmt
        .query_map([pair_id], |row| {
            let kp_str: Option<String> = row.get(7)?;
            let ex_str: Option<String> = row.get(8)?;
            let exer_str: Option<String> = row.get(9)?;

            Ok(GrammarTopic {
                id: row.get(0)?,
                language_pair_id: row.get(1)?,
                level: row.get(2)?,
                display_order: row.get(3)?,
                title: row.get(4)?,
                title_source: row.get(5)?,
                explanation: row.get(6)?,
                key_points: kp_str.and_then(|s| serde_json::from_str(&s).ok()),
                examples: ex_str.and_then(|s| serde_json::from_str(&s).ok()),
                exercises: exer_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(topics)
}

#[derive(Deserialize)]
pub struct SaveGrammarTopicInput {
    pub pair_id: i64,
    pub level: String,
    pub title: String,
    pub title_source: Option<String>,
    pub explanation: String,
    pub key_points: Option<serde_json::Value>,
    pub examples: Option<serde_json::Value>,
    pub exercises: Option<serde_json::Value>,
}

#[tauri::command]
pub fn save_grammar_topic(
    state: State<'_, DbState>,
    input: SaveGrammarTopicInput,
) -> Result<String, String> {
    let db = state.db();

    // Generate a unique ID
    let id = format!("ai-{}", chrono::Local::now().timestamp_millis());

    // Find next display_order
    let max_order: i64 = db
        .query_row(
            "SELECT COALESCE(MAX(display_order), 0) FROM grammar_topics WHERE language_pair_id = ?1",
            [input.pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    db.execute(
        "INSERT INTO grammar_topics (id, language_pair_id, level, display_order, title, title_source, explanation, key_points, examples, exercises)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            input.pair_id,
            input.level,
            max_order + 1,
            input.title,
            input.title_source,
            input.explanation,
            input.key_points.map(|v| v.to_string()),
            input.examples.map(|v| v.to_string()),
            input.exercises.map(|v| v.to_string()),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn delete_grammar_topic(
    state: State<'_, DbState>,
    topic_id: String,
    pair_id: i64,
) -> Result<(), String> {
    let db = state.db();
    db.execute(
        "DELETE FROM grammar_topics WHERE id = ?1 AND language_pair_id = ?2",
        rusqlite::params![topic_id, pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
