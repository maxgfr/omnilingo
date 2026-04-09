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
    let db = state.db();

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

#[derive(serde::Deserialize)]
pub struct SaveVerbInput {
    pub pair_id: i64,
    pub infinitive: String,
    pub translation: String,
    pub level: Option<String>,
    pub verb_type: Option<String>,
    pub auxiliary: Option<String>,
    pub is_separable: bool,
    pub conjugations: serde_json::Value,
    pub examples: Option<serde_json::Value>,
}

#[tauri::command]
pub fn save_verb(
    state: State<'_, DbState>,
    input: SaveVerbInput,
) -> Result<i64, String> {
    let db = state.db();
    db.execute(
        "INSERT INTO verbs (language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            input.pair_id, input.infinitive, input.translation, input.level, input.verb_type, input.auxiliary,
            if input.is_separable { 1i64 } else { 0i64 },
            input.conjugations.to_string(),
            input.examples.map(|e| e.to_string()),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn delete_verb(
    state: State<'_, DbState>,
    verb_id: i64,
) -> Result<(), String> {
    let db = state.db();
    db.execute("DELETE FROM verbs WHERE id = ?1", [verb_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_conjugation_stats(
    state: State<'_, DbState>,
    pair_id: i64,
) -> Result<serde_json::Value, String> {
    let db = state.db();
    let mut stmt = db
        .prepare(
            "SELECT session_data FROM sessions
             WHERE language_pair_id = ?1 AND session_type = 'conjugation'
             ORDER BY created_at DESC LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<String> = stmt
        .query_map([pair_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut by_tense: std::collections::HashMap<String, (i64, i64)> = std::collections::HashMap::new();
    let mut by_verb: std::collections::HashMap<String, (i64, i64)> = std::collections::HashMap::new();

    for raw in &rows {
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(raw) {
            let tense = data["tense"].as_str().unwrap_or("unknown").to_string();
            let verb = data["verb"].as_str().unwrap_or("unknown").to_string();
            let correct = data["correct"].as_bool().unwrap_or(false);

            let te = by_tense.entry(tense).or_insert((0, 0));
            te.1 += 1;
            if correct { te.0 += 1; }

            let ve = by_verb.entry(verb).or_insert((0, 0));
            ve.1 += 1;
            if correct { ve.0 += 1; }
        }
    }

    Ok(serde_json::json!({
        "total_sessions": rows.len(),
        "by_tense": by_tense.iter().map(|(k, (c, t))| {
            serde_json::json!({"tense": k, "correct": c, "total": t})
        }).collect::<Vec<_>>(),
        "by_verb": by_verb.iter().map(|(k, (c, t))| {
            serde_json::json!({"verb": k, "correct": c, "total": t})
        }).collect::<Vec<_>>(),
    }))
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
    let db = state.db();

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
