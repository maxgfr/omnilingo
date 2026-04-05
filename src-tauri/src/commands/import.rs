use rusqlite::Connection;
use tauri::State;

use crate::{DbState, BaseDirState};

/// Ensure the settings row exists (no hardcoded language pair -- onboarding handles that)
pub fn ensure_settings_exist(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO settings (id) VALUES (1)",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Re-import builtin data (kept for backwards compatibility but does nothing without data files)
#[tauri::command]
pub fn import_builtin_data(
    _state: State<'_, DbState>,
    _base_dir: State<'_, BaseDirState>,
    _pair_id: i64,
) -> Result<String, String> {
    Ok("No built-in data to import. Use Settings > Data > Import dictionary file.".to_string())
}

/// Import words from a user-provided file (CSV, TSV, or JSON)
///
/// Supported formats:
/// - **TSV/Tabfile** (Wiktionary-Dictionaries format): `word\tdefinition` per line
/// - **CSV**: `source_word,target_word[,gender,level,category]` with optional header
/// - **JSON**: array of objects with `source_word`/`target_word` (or `de`/`fr`, `word`/`definition`)
#[tauri::command]
pub fn import_from_file(
    state: State<'_, DbState>,
    pair_id: i64,
    content: String,
    format: String,
) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, gender, level, category)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .map_err(|e| e.to_string())?;

    let mut imported = 0i64;

    match format.as_str() {
        "tsv" | "tabfile" => {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                let parts: Vec<&str> = line.splitn(2, '\t').collect();
                if parts.len() >= 2 {
                    let source = parts[0].trim();
                    let target = parts[1].trim();
                    if !source.is_empty() && !target.is_empty() {
                        let _ = stmt.execute(rusqlite::params![
                            pair_id, source, target,
                            Option::<String>::None, Option::<String>::None, Option::<String>::None
                        ]);
                        imported += 1;
                    }
                }
            }
        }
        "csv" => {
            let mut is_first = true;
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                if is_first {
                    is_first = false;
                    let lower = line.to_lowercase();
                    if lower.contains("source") || lower.contains("word") || lower.contains("mot") {
                        continue;
                    }
                }
                let parts: Vec<String> = parse_csv_line(line);
                if parts.len() >= 2 {
                    let source = parts[0].trim().to_string();
                    let target = parts[1].trim().to_string();
                    let gender = parts.get(2).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                    let level = parts.get(3).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                    let category = parts.get(4).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                    if !source.is_empty() && !target.is_empty() {
                        let _ = stmt.execute(rusqlite::params![pair_id, source, target, gender, level, category]);
                        imported += 1;
                    }
                }
            }
        }
        "json" => {
            let arr: Vec<serde_json::Value> =
                serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;
            for obj in &arr {
                let source = obj
                    .get("source_word").or_else(|| obj.get("de")).or_else(|| obj.get("word"))
                    .or_else(|| obj.get("source")).or_else(|| obj.get("term"))
                    .and_then(|v| v.as_str());
                let target = obj
                    .get("target_word").or_else(|| obj.get("fr")).or_else(|| obj.get("definition"))
                    .or_else(|| obj.get("target")).or_else(|| obj.get("translation"))
                    .and_then(|v| v.as_str());

                if let (Some(src), Some(tgt)) = (source, target) {
                    if !src.is_empty() && !tgt.is_empty() {
                        let gender = obj.get("gender").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let level = obj.get("level").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let category = obj.get("category").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let _ = stmt.execute(rusqlite::params![pair_id, src, tgt, gender, level, category]);
                        imported += 1;
                    }
                }
            }
        }
        _ => return Err(format!("Unsupported format: {}", format)),
    }

    Ok(format!("Imported {} words", imported))
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in line.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            ',' | ';' if !in_quotes => {
                fields.push(current.clone());
                current.clear();
            }
            _ => current.push(ch),
        }
    }
    fields.push(current);
    fields
}
