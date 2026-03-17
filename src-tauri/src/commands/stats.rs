use serde::Serialize;
use tauri::State;

use crate::DbState;

#[derive(Serialize)]
pub struct DailyStatRow {
    pub date: String,
    pub words_learned: i64,
    pub words_reviewed: i64,
    pub correct_count: i64,
    pub total_count: i64,
}

#[derive(Serialize)]
pub struct OverviewStats {
    pub total_words: i64,
    pub total_learned: i64,
    pub total_reviews: i64,
    pub total_grammar_completed: i64,
    pub total_grammar: i64,
    pub streak: i64,
    pub accuracy: i64,
    pub study_days: i64,
    pub favorite_count: i64,
}

/// Get daily stats for the last N days
#[tauri::command]
pub fn get_daily_stats(
    state: State<'_, DbState>,
    pair_id: i64,
    days: i64,
) -> Result<Vec<DailyStatRow>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT
                date(created_at) as d,
                SUM(CASE WHEN session_type = 'learn' THEN 1 ELSE 0 END),
                SUM(CASE WHEN session_type IN ('review', 'review_error') THEN 1 ELSE 0 END),
                SUM(CASE WHEN session_type = 'review' THEN 1 ELSE 0 END),
                COUNT(*)
             FROM sessions
             WHERE language_pair_id = ?1
               AND created_at >= date('now', '-' || ?2 || ' days')
             GROUP BY d
             ORDER BY d",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map(rusqlite::params![pair_id, days], |row| {
            Ok(DailyStatRow {
                date: row.get(0)?,
                words_learned: row.get(1)?,
                words_reviewed: row.get(2)?,
                correct_count: row.get(3)?,
                total_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Get overview stats
#[tauri::command]
pub fn get_overview_stats(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<OverviewStats, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let total_words: i64 = db
        .query_row("SELECT COUNT(*) FROM words WHERE language_pair_id = ?1", [pair_id], |r| r.get(0))
        .unwrap_or(0);

    let total_learned: i64 = db
        .query_row("SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1", [pair_id], |r| r.get(0))
        .unwrap_or(0);

    let total_reviews: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM sessions WHERE language_pair_id = ?1 AND session_type IN ('review', 'review_error')",
            [pair_id], |r| r.get(0),
        )
        .unwrap_or(0);

    let total_grammar_completed: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM grammar_progress WHERE language_pair_id = ?1 AND completed = 1",
            [pair_id], |r| r.get(0),
        )
        .unwrap_or(0);

    let total_grammar: i64 = db
        .query_row("SELECT COUNT(*) FROM grammar_topics WHERE language_pair_id = ?1", [pair_id], |r| r.get(0))
        .unwrap_or(0);

    let streak: i64 = db
        .query_row("SELECT streak FROM settings WHERE id = 1", [], |r| r.get(0))
        .unwrap_or(0);

    let accuracy = crate::commands::srs::compute_accuracy(&db, pair_id);

    let study_days: i64 = db
        .query_row(
            "SELECT COUNT(DISTINCT date(created_at)) FROM sessions WHERE language_pair_id = ?1",
            [pair_id], |r| r.get(0),
        )
        .unwrap_or(0);

    let favorite_count: i64 = db
        .query_row("SELECT COUNT(*) FROM favorites WHERE language_pair_id = ?1", [pair_id], |r| r.get(0))
        .unwrap_or(0);

    Ok(OverviewStats {
        total_words,
        total_learned,
        total_reviews,
        total_grammar_completed,
        total_grammar,
        streak,
        accuracy,
        study_days,
        favorite_count,
    })
}

/// Log an error to the errors table
#[tauri::command]
pub fn log_error(
    state: State<'_, DbState>,
    pair_id: i64,
    error_type: String,
    word_or_topic: String,
    user_answer: String,
    correct_answer: String,
) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO errors (language_pair_id, error_type, word_or_topic, user_answer, correct_answer) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![pair_id, error_type, word_or_topic, user_answer, correct_answer],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get frequent errors for AI targeting
#[tauri::command]
pub fn get_frequent_errors(
    state: State<'_, DbState>,
    pair_id: i64,
    limit: Option<i64>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20);
    let mut stmt = db
        .prepare(
            "SELECT word_or_topic, error_type, COUNT(*) as cnt, correct_answer
             FROM errors
             WHERE language_pair_id = ?1
             GROUP BY word_or_topic, error_type
             ORDER BY cnt DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map(rusqlite::params![pair_id, limit], |row| {
            Ok(serde_json::json!({
                "word": row.get::<_, String>(0)?,
                "type": row.get::<_, String>(1)?,
                "count": row.get::<_, i64>(2)?,
                "correct": row.get::<_, String>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Add a custom word
#[tauri::command]
pub fn add_custom_word(
    state: State<'_, DbState>,
    pair_id: i64,
    source_word: String,
    target_word: String,
    gender: Option<String>,
    level: Option<String>,
    category: Option<String>,
) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO words (language_pair_id, source_word, target_word, gender, level, category) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![pair_id, source_word, target_word, gender, level, category],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

/// Get a random word for "word of the day"
#[tauri::command]
pub fn get_random_word(state: State<'_, DbState>, pair_id: i64) -> Result<Option<serde_json::Value>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let result = db.query_row(
        "SELECT id, source_word, target_word, gender, plural, level, category, example_source, example_target
         FROM words WHERE language_pair_id = ?1 ORDER BY RANDOM() LIMIT 1",
        [pair_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "source_word": row.get::<_, String>(1)?,
                "target_word": row.get::<_, String>(2)?,
                "gender": row.get::<_, Option<String>>(3)?,
                "plural": row.get::<_, Option<String>>(4)?,
                "level": row.get::<_, Option<String>>(5)?,
                "category": row.get::<_, Option<String>>(6)?,
                "example_source": row.get::<_, Option<String>>(7)?,
                "example_target": row.get::<_, Option<String>>(8)?,
            }))
        },
    );

    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
