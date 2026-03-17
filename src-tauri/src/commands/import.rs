use rusqlite::Connection;
use serde::Deserialize;
use std::path::Path;
use tauri::State;

use crate::{DbState, BaseDirState};

#[derive(Deserialize)]
struct DictEntry {
    de: String,
    fr: String,
    gender: Option<String>,
    plural: Option<String>,
    level: Option<String>,
    category: Option<String>,
    example: Option<DictExample>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct DictExample {
    de: String,
    fr: String,
}

#[derive(Deserialize)]
struct VerbEntry {
    infinitive: String,
    french: String,
    level: Option<String>,
    #[serde(rename = "type")]
    verb_type: Option<String>,
    auxiliary: Option<String>,
    separable: Option<bool>,
    conjugations: serde_json::Value,
    examples: Option<Vec<DictExample>>,
}

#[derive(Deserialize)]
struct GrammarTopicEntry {
    id: String,
    level: String,
    order: i64,
    title: String,
    #[serde(rename = "titleDe")]
    title_de: Option<String>,
    explanation: String,
    #[serde(rename = "keyPoints")]
    key_points: Option<Vec<String>>,
    examples: Option<serde_json::Value>,
    exercises: Option<serde_json::Value>,
}

/// Ensure the default DE-FR language pair exists, return its ID
pub fn ensure_default_pair(conn: &Connection) -> Result<i64, String> {
    conn.execute(
        "INSERT OR IGNORE INTO language_pairs (source_lang, target_lang, source_name, target_name, source_flag, target_flag, is_active)
         VALUES ('de', 'fr', 'Allemand', 'Français', '🇩🇪', '🇫🇷', 1)",
        [],
    )
    .map_err(|e| e.to_string())?;

    let pair_id: i64 = conn
        .query_row(
            "SELECT id FROM language_pairs WHERE source_lang = 'de' AND target_lang = 'fr'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Set as active if no active pair
    conn.execute(
        "UPDATE settings SET active_language_pair_id = ?1 WHERE id = 1 AND active_language_pair_id IS NULL",
        [pair_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(pair_id)
}

/// Auto-import builtin data on first launch
pub fn auto_import_builtin(conn: &Connection, base_dir: &Path) -> Result<(), String> {
    let pair_id = ensure_default_pair(conn)?;

    // Check if already imported
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM words WHERE language_pair_id = ?1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if count > 0 {
        return Ok(()); // Already imported
    }

    import_dictionary(conn, base_dir, pair_id)?;
    import_verbs(conn, base_dir, pair_id)?;
    import_grammar(conn, base_dir, pair_id)?;

    Ok(())
}

fn import_dictionary(conn: &Connection, base_dir: &Path, pair_id: i64) -> Result<(), String> {
    let dict_path = base_dir.join("data/dictionary.json");
    if !dict_path.exists() {
        return Ok(());
    }

    let data = std::fs::read_to_string(&dict_path)
        .map_err(|e| format!("Failed to read dictionary.json: {}", e))?;
    let entries: Vec<DictEntry> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse dictionary.json: {}", e))?;

    // Create builtin pack
    conn.execute(
        "INSERT INTO dictionary_packs (language_pair_id, source, version, word_count)
         VALUES (?1, 'builtin', '1.0', ?2)",
        rusqlite::params![pair_id, entries.len() as i64],
    )
    .map_err(|e| e.to_string())?;

    let pack_id = conn.last_insert_rowid();

    let mut stmt = conn
        .prepare(
            "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, gender, plural, level, category, tags, example_source, example_target, pack_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        )
        .map_err(|e| e.to_string())?;

    for entry in &entries {
        let tags = entry.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        let (ex_src, ex_tgt) = match &entry.example {
            Some(ex) => (Some(ex.de.clone()), Some(ex.fr.clone())),
            None => (None, None),
        };

        let _ = stmt.execute(rusqlite::params![
            pair_id,
            entry.de,
            entry.fr,
            entry.gender,
            entry.plural,
            entry.level,
            entry.category,
            tags,
            ex_src,
            ex_tgt,
            pack_id,
        ]);
    }

    Ok(())
}

fn import_verbs(conn: &Connection, base_dir: &Path, pair_id: i64) -> Result<(), String> {
    let verbs_path = base_dir.join("data/verbs.json");
    if !verbs_path.exists() {
        return Ok(());
    }

    let data = std::fs::read_to_string(&verbs_path)
        .map_err(|e| format!("Failed to read verbs.json: {}", e))?;
    let entries: Vec<VerbEntry> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse verbs.json: {}", e))?;

    let mut stmt = conn
        .prepare(
            "INSERT OR IGNORE INTO verbs (language_pair_id, infinitive, translation, level, verb_type, auxiliary, is_separable, conjugations, examples)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .map_err(|e| e.to_string())?;

    for entry in &entries {
        let conj_json = serde_json::to_string(&entry.conjugations).unwrap_or_default();
        let examples_json = entry
            .examples
            .as_ref()
            .map(|exs| {
                serde_json::to_string(
                    &exs.iter()
                        .map(|e| serde_json::json!({"de": e.de, "fr": e.fr}))
                        .collect::<Vec<_>>(),
                )
                .unwrap_or_default()
            });

        let _ = stmt.execute(rusqlite::params![
            pair_id,
            entry.infinitive,
            entry.french,
            entry.level,
            entry.verb_type,
            entry.auxiliary,
            entry.separable.unwrap_or(false) as i64,
            conj_json,
            examples_json,
        ]);
    }

    Ok(())
}

fn import_grammar(conn: &Connection, base_dir: &Path, pair_id: i64) -> Result<(), String> {
    let grammar_path = base_dir.join("data/grammar-topics.json");
    if !grammar_path.exists() {
        return Ok(());
    }

    let data = std::fs::read_to_string(&grammar_path)
        .map_err(|e| format!("Failed to read grammar-topics.json: {}", e))?;
    let entries: Vec<GrammarTopicEntry> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse grammar-topics.json: {}", e))?;

    let mut stmt = conn
        .prepare(
            "INSERT OR IGNORE INTO grammar_topics (id, language_pair_id, level, display_order, title, title_source, explanation, key_points, examples, exercises)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )
        .map_err(|e| e.to_string())?;

    for entry in &entries {
        let key_points_json = entry
            .key_points
            .as_ref()
            .map(|kp| serde_json::to_string(kp).unwrap_or_default());
        let examples_json = entry
            .examples
            .as_ref()
            .map(|ex| serde_json::to_string(ex).unwrap_or_default());
        let exercises_json = entry
            .exercises
            .as_ref()
            .map(|ex| serde_json::to_string(ex).unwrap_or_default());

        let _ = stmt.execute(rusqlite::params![
            entry.id,
            pair_id,
            entry.level,
            entry.order,
            entry.title,
            entry.title_de,
            entry.explanation,
            key_points_json,
            examples_json,
            exercises_json,
        ]);
    }

    Ok(())
}

#[tauri::command]
pub fn import_builtin_data(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    pair_id: i64,
) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Clear existing data for this pair
    db.execute("DELETE FROM words WHERE language_pair_id = ?1", [pair_id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM verbs WHERE language_pair_id = ?1", [pair_id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM grammar_topics WHERE language_pair_id = ?1", [pair_id])
        .map_err(|e| e.to_string())?;

    import_dictionary(&db, &base_dir.0, pair_id)?;
    import_verbs(&db, &base_dir.0, pair_id)?;
    import_grammar(&db, &base_dir.0, pair_id)?;

    let word_count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM words WHERE language_pair_id = ?1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(format!("Imported {} words", word_count))
}
