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

/// Export all learning data as JSON
#[tauri::command]
pub fn export_progress(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<serde_json::Value, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // SRS cards
    let mut srs_stmt = db.prepare(
        "SELECT sc.word_id, w.source_word, w.target_word, w.gender, w.level, w.category,
                sc.repetitions, sc.ease_factor, sc.interval_days, sc.next_review, sc.last_score, sc.added_date
         FROM srs_cards sc JOIN words w ON w.id = sc.word_id
         WHERE sc.language_pair_id = ?1"
    ).map_err(|e| e.to_string())?;
    let srs_cards: Vec<serde_json::Value> = srs_stmt.query_map([pair_id], |row| {
        Ok(serde_json::json!({
            "word_id": row.get::<_, i64>(0)?,
            "source_word": row.get::<_, String>(1)?,
            "target_word": row.get::<_, String>(2)?,
            "gender": row.get::<_, Option<String>>(3)?,
            "level": row.get::<_, Option<String>>(4)?,
            "category": row.get::<_, Option<String>>(5)?,
            "repetitions": row.get::<_, i64>(6)?,
            "ease_factor": row.get::<_, f64>(7)?,
            "interval_days": row.get::<_, i64>(8)?,
            "next_review": row.get::<_, String>(9)?,
            "last_score": row.get::<_, Option<i64>>(10)?,
            "added_date": row.get::<_, Option<String>>(11)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Grammar progress
    let mut grammar_stmt = db.prepare(
        "SELECT topic_id, completed, score_correct, score_total, completed_at
         FROM grammar_progress WHERE language_pair_id = ?1"
    ).map_err(|e| e.to_string())?;
    let grammar: Vec<serde_json::Value> = grammar_stmt.query_map([pair_id], |row| {
        Ok(serde_json::json!({
            "topic_id": row.get::<_, String>(0)?,
            "completed": row.get::<_, i64>(1)?,
            "score_correct": row.get::<_, i64>(2)?,
            "score_total": row.get::<_, i64>(3)?,
            "completed_at": row.get::<_, Option<String>>(4)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Favorites
    let mut fav_stmt = db.prepare(
        "SELECT w.source_word, w.target_word FROM favorites f JOIN words w ON w.id = f.word_id WHERE f.language_pair_id = ?1"
    ).map_err(|e| e.to_string())?;
    let favorites: Vec<serde_json::Value> = fav_stmt.query_map([pair_id], |row| {
        Ok(serde_json::json!({ "source_word": row.get::<_, String>(0)?, "target_word": row.get::<_, String>(1)? }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Settings
    let settings: serde_json::Value = db.query_row(
        "SELECT level, words_per_day, streak, last_session_date, start_date FROM settings WHERE id = 1",
        [], |row| {
            Ok(serde_json::json!({
                "level": row.get::<_, String>(0)?,
                "words_per_day": row.get::<_, i64>(1)?,
                "streak": row.get::<_, i64>(2)?,
                "last_session_date": row.get::<_, Option<String>>(3)?,
                "start_date": row.get::<_, Option<String>>(4)?,
            }))
        }
    ).map_err(|e| e.to_string())?;

    // Pair info
    let pair_info: serde_json::Value = db.query_row(
        "SELECT source_lang, target_lang, source_name, target_name FROM language_pairs WHERE id = ?1",
        [pair_id], |row| {
            Ok(serde_json::json!({
                "source_lang": row.get::<_, String>(0)?,
                "target_lang": row.get::<_, String>(1)?,
                "source_name": row.get::<_, String>(2)?,
                "target_name": row.get::<_, String>(3)?,
            }))
        }
    ).map_err(|e| e.to_string())?;

    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    Ok(serde_json::json!({
        "version": "2.0",
        "exported_at": now,
        "language_pair": pair_info,
        "settings": settings,
        "srs_cards": srs_cards,
        "grammar_progress": grammar,
        "favorites": favorites,
    }))
}

/// Import learning data from JSON (merge mode)
#[tauri::command]
pub fn import_progress(
    state: State<'_, DbState>,
    pair_id: i64,
    data: serde_json::Value,
) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut imported = 0;

    // Import SRS cards
    if let Some(cards) = data["srs_cards"].as_array() {
        for card in cards {
            let source = card["source_word"].as_str().unwrap_or_default();
            // Find the word in the DB
            let word_id: Option<i64> = db.query_row(
                "SELECT id FROM words WHERE language_pair_id = ?1 AND source_word = ?2",
                rusqlite::params![pair_id, source],
                |row| row.get(0),
            ).ok();

            if let Some(wid) = word_id {
                let ef = card["ease_factor"].as_f64().unwrap_or(2.5);
                let interval = card["interval_days"].as_i64().unwrap_or(0);
                let reps = card["repetitions"].as_i64().unwrap_or(0);
                let next = card["next_review"].as_str().unwrap_or("2026-01-01");
                let score = card["last_score"].as_i64();

                let _ = db.execute(
                    "INSERT OR REPLACE INTO srs_cards (word_id, language_pair_id, repetitions, ease_factor, interval_days, next_review, last_score)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![wid, pair_id, reps, ef, interval, next, score],
                );
                imported += 1;
            }
        }
    }

    // Import grammar progress
    if let Some(topics) = data["grammar_progress"].as_array() {
        for tp in topics {
            let topic_id = tp["topic_id"].as_str().unwrap_or_default();
            let completed = tp["completed"].as_i64().unwrap_or(0);
            let correct = tp["score_correct"].as_i64().unwrap_or(0);
            let total = tp["score_total"].as_i64().unwrap_or(0);
            let at = tp["completed_at"].as_str();

            let _ = db.execute(
                "INSERT OR REPLACE INTO grammar_progress (topic_id, language_pair_id, completed, score_correct, score_total, completed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![topic_id, pair_id, completed, correct, total, at],
            );
        }
    }

    // Import settings
    if let Some(settings) = data["settings"].as_object() {
        if let Some(level) = settings.get("level").and_then(|v| v.as_str()) {
            let _ = db.execute("UPDATE settings SET level = ?1 WHERE id = 1", [level]);
        }
        if let Some(wpd) = settings.get("words_per_day").and_then(|v| v.as_i64()) {
            let _ = db.execute("UPDATE settings SET words_per_day = ?1 WHERE id = 1", rusqlite::params![wpd]);
        }
    }

    Ok(format!("Imported {} SRS cards", imported))
}
