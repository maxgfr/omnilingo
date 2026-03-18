use serde::Serialize;
use tauri::State;

use crate::DbState;

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

fn row_to_verb(row: &rusqlite::Row<'_>) -> rusqlite::Result<Verb> {
    let conj_str: String = row.get(8)?;
    let ex_str: Option<String> = row.get(9)?;

    Ok(Verb {
        id: row.get(0)?,
        language_pair_id: row.get(1)?,
        infinitive: row.get(2)?,
        translation: row.get(3)?,
        level: row.get(4)?,
        verb_type: row.get(5)?,
        auxiliary: row.get(6)?,
        is_separable: row.get::<_, i64>(7)? != 0,
        conjugations: serde_json::from_str(&conj_str).unwrap_or(serde_json::Value::Object(Default::default())),
        examples: ex_str.and_then(|s| serde_json::from_str(&s).ok()),
    })
}

#[tauri::command]
pub fn get_verbs(
    state: State<'_, DbState>,
    pair_id: i64,
    query: Option<String>,
) -> Result<Vec<Verb>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(q) = query {
        let pattern = format!("%{}%", q);
        let mut stmt = db
            .prepare(
                "SELECT id, language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples
                 FROM verbs
                 WHERE language_pair_id = ?1 AND (infinitive LIKE ?2 OR translation LIKE ?2)
                 ORDER BY infinitive",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map(rusqlite::params![pair_id, pattern], row_to_verb)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    } else {
        let mut stmt = db
            .prepare(
                "SELECT id, language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples
                 FROM verbs
                 WHERE language_pair_id = ?1
                 ORDER BY infinitive",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt.query_map([pair_id], row_to_verb)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }
}

#[tauri::command]
pub fn log_conjugation_session(
    state: State<'_, DbState>,
    base_dir: State<'_, crate::BaseDirState>,
    pair_id: i64,
    verb: String,
    tense: String,
    correct: bool,
    errors: Vec<String>,
) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let data = serde_json::json!({
        "verb": verb,
        "tense": tense,
        "correct": correct,
        "errors": errors,
    });
    db.execute(
        "INSERT INTO sessions (language_pair_id, session_type, session_data) VALUES (?1, 'conjugation', ?2)",
        rusqlite::params![pair_id, data.to_string()],
    )
    .map_err(|e| e.to_string())?;

    let memory_dir = base_dir.0.join("memory");
    let log_path = memory_dir.join("conjugation-log.md");
    let mut content = std::fs::read_to_string(&log_path).unwrap_or_else(|_| "# Conjugation Log\n\n".to_string());
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let time = chrono::Local::now().format("%H:%M").to_string();
    let status = if correct { "Correct" } else { "Errors" };
    content.push_str(&format!(
        "\n## {} {} — {} ({})\n- Status: {}\n",
        date, time, verb, tense, status
    ));
    if !errors.is_empty() {
        content.push_str(&format!("- Errors: {}\n", errors.join(", ")));
    }
    let _ = std::fs::write(&log_path, content);

    Ok(())
}
