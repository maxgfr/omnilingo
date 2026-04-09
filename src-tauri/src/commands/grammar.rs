use serde::{Serialize, Deserialize};
use tauri::State;

use crate::{DbState, BaseDirState};

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
    pub completed: bool,
    pub score_correct: i64,
    pub score_total: i64,
}

#[tauri::command]
pub fn get_grammar_topics(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<GrammarTopic>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT gt.id, gt.language_pair_id, gt.level, gt.display_order, gt.title, gt.title_source,
                    gt.explanation, gt.key_points, gt.examples, gt.exercises,
                    COALESCE(gp.completed, 0), COALESCE(gp.score_correct, 0), COALESCE(gp.score_total, 0)
             FROM grammar_topics gt
             LEFT JOIN grammar_progress gp ON gp.topic_id = gt.id AND gp.language_pair_id = gt.language_pair_id
             WHERE gt.language_pair_id = ?1
             ORDER BY gt.level, gt.display_order",
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
                completed: row.get::<_, i64>(10)? != 0,
                score_correct: row.get(11)?,
                score_total: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(topics)
}

#[tauri::command]
pub fn mark_grammar_completed(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    topic_id: String,
    pair_id: i64,
    correct: i64,
    total: i64,
) -> Result<(), String> {
    let db = state.db();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();

    db.execute(
        "INSERT INTO grammar_progress (topic_id, language_pair_id, completed, score_correct, score_total, completed_at)
         VALUES (?1, ?2, 1, ?3, ?4, ?5)
         ON CONFLICT(topic_id, language_pair_id)
         DO UPDATE SET completed = 1, score_correct = ?3, score_total = ?4, completed_at = ?5",
        rusqlite::params![topic_id, pair_id, correct, total, now],
    )
    .map_err(|e| e.to_string())?;

    // Log to grammar-log.md
    let title: String = db
        .query_row(
            "SELECT title FROM grammar_topics WHERE id = ?1",
            [&topic_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| topic_id.clone());

    let level: String = db
        .query_row(
            "SELECT level FROM grammar_topics WHERE id = ?1",
            [&topic_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    let memory_dir = base_dir.0.join("memory");
    let log_path = memory_dir.join("grammar-log.md");
    let mut content = std::fs::read_to_string(&log_path).unwrap_or_else(|_| "# Grammar Log\n\n".to_string());
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    content.push_str(&format!(
        "\n## {} — {}\n- Level: {}\n- Score: {}/{}\n- Status: ✓ Completed\n",
        date, title, level, correct, total
    ));
    let _ = std::fs::write(&log_path, content);

    Ok(())
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
    db.execute(
        "DELETE FROM grammar_progress WHERE topic_id = ?1 AND language_pair_id = ?2",
        rusqlite::params![topic_id, pair_id],
    )
    .map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM grammar_srs WHERE topic_id = ?1 AND language_pair_id = ?2",
        rusqlite::params![topic_id, pair_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct GrammarSrsState {
    pub topic_id: String,
    pub language_pair_id: i64,
    pub repetitions: i64,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub next_review: String,
    pub last_score: Option<i64>,
}

#[tauri::command]
pub fn get_due_grammar_topics(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<Vec<GrammarSrsState>, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT topic_id, language_pair_id, repetitions, ease_factor, interval_days, next_review, last_score
             FROM grammar_srs
             WHERE language_pair_id = ?1 AND next_review <= date('now','localtime')
             ORDER BY next_review",
        )
        .map_err(|e| e.to_string())?;

    let topics = stmt
        .query_map([pair_id], |row| {
            Ok(GrammarSrsState {
                topic_id: row.get(0)?,
                language_pair_id: row.get(1)?,
                repetitions: row.get(2)?,
                ease_factor: row.get(3)?,
                interval_days: row.get(4)?,
                next_review: row.get(5)?,
                last_score: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(topics)
}

#[tauri::command]
pub fn review_grammar_topic(
    state: State<'_, DbState>,
    topic_id: String,
    pair_id: i64,
    quality: i64,
) -> Result<GrammarSrsState, String> {
    if !(0..=5).contains(&quality) {
        return Err(format!("Invalid quality: {}", quality));
    }

    let db = state.db();

    // Get or create grammar_srs entry
    let existing: Option<(i64, f64, i64)> = db
        .query_row(
            "SELECT repetitions, ease_factor, interval_days FROM grammar_srs WHERE topic_id = ?1 AND language_pair_id = ?2",
            rusqlite::params![topic_id, pair_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    let (reps, ef, interval) = existing.unwrap_or((0, 2.5, 0));

    // SM-2 algorithm
    let (new_reps, new_interval) = if quality < 3 {
        (0_i64, 0_i64)
    } else {
        let new_reps = reps + 1;
        let new_interval = match new_reps {
            1 => 1,
            2 => 3,
            _ => (interval as f64 * ef).round() as i64,
        };
        (new_reps, new_interval)
    };

    let q = quality as f64;
    let new_ef = ef + (0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02));
    let new_ef = if new_ef < 1.3 { 1.3 } else { new_ef };

    let days_to_add = if new_interval > 0 { new_interval } else { 1 };
    let next_review = (chrono::Local::now().date_naive() + chrono::naive::Days::new(days_to_add as u64))
        .format("%Y-%m-%d")
        .to_string();

    db.execute(
        "INSERT INTO grammar_srs (topic_id, language_pair_id, repetitions, ease_factor, interval_days, next_review, last_score)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(topic_id, language_pair_id)
         DO UPDATE SET repetitions = ?3, ease_factor = ?4, interval_days = ?5, next_review = ?6, last_score = ?7",
        rusqlite::params![topic_id, pair_id, new_reps, new_ef, new_interval, next_review, quality],
    )
    .map_err(|e| e.to_string())?;

    Ok(GrammarSrsState {
        topic_id,
        language_pair_id: pair_id,
        repetitions: new_reps,
        ease_factor: new_ef,
        interval_days: new_interval,
        next_review,
        last_score: Some(quality),
    })
}
