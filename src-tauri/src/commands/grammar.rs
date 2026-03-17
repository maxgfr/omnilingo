use serde::Serialize;
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
    let db = state.0.lock().map_err(|e| e.to_string())?;
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
    let db = state.0.lock().map_err(|e| e.to_string())?;
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
    let mut content = std::fs::read_to_string(&log_path).unwrap_or_else(|_| "# Journal de grammaire\n\n".to_string());
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    content.push_str(&format!(
        "\n## {} — {}\n- Niveau : {}\n- Résultat : {}/{}\n- Statut : ✓ Complété\n",
        date, title, level, correct, total
    ));
    let _ = std::fs::write(&log_path, content);

    Ok(())
}
