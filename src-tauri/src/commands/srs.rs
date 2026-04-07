use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::{DbState, BaseDirState};

#[derive(Serialize)]
pub struct SrsCard {
    pub id: i64,
    pub word_id: i64,
    pub source_word: String,
    pub target_word: String,
    pub gender: Option<String>,
    pub plural: Option<String>,
    pub level: Option<String>,
    pub category: Option<String>,
    pub example_source: Option<String>,
    pub example_target: Option<String>,
    pub repetitions: i64,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub next_review: String,
    pub last_score: Option<i64>,
    pub card_type: String,
    pub deck: String,
    pub cloze_sentence: Option<String>,
}

#[derive(Serialize)]
pub struct SrsStats {
    pub total_cards: i64,
    pub due_count: i64,
    pub average_accuracy: i64,
}

fn row_to_card(row: &rusqlite::Row<'_>) -> rusqlite::Result<SrsCard> {
    Ok(SrsCard {
        id: row.get(0)?,
        word_id: row.get(1)?,
        source_word: row.get(2)?,
        target_word: row.get(3)?,
        gender: row.get(4)?,
        plural: row.get(5)?,
        level: row.get(6)?,
        category: row.get(7)?,
        example_source: row.get(8)?,
        example_target: row.get(9)?,
        repetitions: row.get(10)?,
        ease_factor: row.get(11)?,
        interval_days: row.get(12)?,
        next_review: row.get(13)?,
        last_score: row.get(14)?,
        card_type: row.get::<_, Option<String>>(15)?.unwrap_or_else(|| "translation".to_string()),
        deck: row.get::<_, Option<String>>(16)?.unwrap_or_else(|| "default".to_string()),
        cloze_sentence: row.get(17)?,
    })
}

const CARD_SELECT: &str =
    "SELECT sc.id, sc.word_id, w.source_word, w.target_word, w.gender, w.plural, w.level, w.category, w.example_source, w.example_target,
            sc.repetitions, sc.ease_factor, sc.interval_days, sc.next_review, sc.last_score,
            sc.card_type, sc.deck, sc.cloze_sentence
     FROM srs_cards sc
     JOIN words w ON w.id = sc.word_id";

#[tauri::command]
pub fn add_word_to_srs(
    state: State<'_, DbState>,
    word_id: i64,
    card_type: Option<String>,
    deck: Option<String>,
    cloze_sentence: Option<String>,
) -> Result<SrsCard, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let pair_id: i64 = db
        .query_row("SELECT language_pair_id FROM words WHERE id = ?1", [word_id], |row| row.get(0))
        .map_err(|e| format!("Word not found: {}", e))?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let ct = card_type.unwrap_or_else(|| "translation".to_string());
    let dk = deck.unwrap_or_else(|| "default".to_string());

    db.execute(
        "INSERT OR IGNORE INTO srs_cards (word_id, language_pair_id, next_review, card_type, deck, cloze_sentence) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![word_id, pair_id, today, ct, dk, cloze_sentence],
    )
    .map_err(|e| e.to_string())?;

    let card = db
        .query_row(
            &format!("{} WHERE sc.word_id = ?1", CARD_SELECT),
            rusqlite::params![word_id],
            row_to_card,
        )
        .map_err(|e| e.to_string())?;

    Ok(card)
}

#[tauri::command]
pub fn get_due_cards(state: State<'_, DbState>, pair_id: i64, deck: Option<String>) -> Result<Vec<SrsCard>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(dk) = deck {
        let mut stmt = db
            .prepare(&format!(
                "{} WHERE sc.language_pair_id = ?1 AND sc.deck = ?2 AND sc.next_review <= date('now') ORDER BY sc.next_review",
                CARD_SELECT
            ))
            .map_err(|e| e.to_string())?;
        let cards = stmt
            .query_map(rusqlite::params![pair_id, dk], row_to_card)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(cards)
    } else {
        let mut stmt = db
            .prepare(&format!(
                "{} WHERE sc.language_pair_id = ?1 AND sc.next_review <= date('now') ORDER BY sc.next_review",
                CARD_SELECT
            ))
            .map_err(|e| e.to_string())?;
        let cards = stmt
            .query_map([pair_id], row_to_card)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(cards)
    }
}

#[tauri::command]
pub fn get_all_srs_cards(
    state: State<'_, DbState>,
    pair_id: i64,
    deck: Option<String>,
) -> Result<Vec<SrsCard>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(dk) = deck {
        let mut stmt = db
            .prepare(&format!(
                "{} WHERE sc.language_pair_id = ?1 AND sc.deck = ?2 ORDER BY w.source_word",
                CARD_SELECT
            ))
            .map_err(|e| e.to_string())?;
        let cards = stmt
            .query_map(rusqlite::params![pair_id, dk], row_to_card)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(cards)
    } else {
        let mut stmt = db
            .prepare(&format!(
                "{} WHERE sc.language_pair_id = ?1 ORDER BY w.source_word",
                CARD_SELECT
            ))
            .map_err(|e| e.to_string())?;
        let cards = stmt
            .query_map([pair_id], row_to_card)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(cards)
    }
}

#[tauri::command]
pub fn get_due_count(state: State<'_, DbState>, pair_id: i64) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1 AND next_review <= date('now')",
        [pair_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// SM-2 algorithm: review a card and update in DB
#[tauri::command]
pub fn review_card(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    card_id: i64,
    quality: i64,
) -> Result<SrsCard, String> {
    if !(0..=5).contains(&quality) {
        return Err(format!("Invalid quality value: {}. Must be between 0 and 5 (SM-2 algorithm).", quality));
    }

    let db = state.0.lock().map_err(|e| e.to_string())?;

    let (reps, ef, interval): (i64, f64, i64) = db
        .query_row(
            "SELECT repetitions, ease_factor, interval_days FROM srs_cards WHERE id = ?1",
            [card_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Card not found: {}", e))?;

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
        "UPDATE srs_cards SET repetitions = ?1, ease_factor = ?2, interval_days = ?3, next_review = ?4, last_score = ?5 WHERE id = ?6",
        rusqlite::params![new_reps, new_ef, new_interval, next_review, quality, card_id],
    )
    .map_err(|e| e.to_string())?;

    let card = db
        .query_row(
            &format!("{} WHERE sc.id = ?1", CARD_SELECT),
            [card_id],
            row_to_card,
        )
        .map_err(|e| e.to_string())?;

    // Sync vocabulary.md
    let pair_id: i64 = db
        .query_row("SELECT language_pair_id FROM srs_cards WHERE id = ?1", [card_id], |row| row.get(0))
        .unwrap_or(1);
    let _ = sync_vocabulary_markdown(&db, pair_id, &base_dir.0);

    Ok(card)
}

#[tauri::command]
pub fn delete_srs_card(state: State<'_, DbState>, card_id: i64) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM srs_cards WHERE id = ?1", [card_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_srs_stats(state: State<'_, DbState>, pair_id: i64) -> Result<SrsStats, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let total_cards: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let due_count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1 AND next_review <= date('now')",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let accuracy = compute_accuracy(&db, pair_id);

    Ok(SrsStats {
        total_cards,
        due_count,
        average_accuracy: accuracy,
    })
}

pub fn compute_accuracy(db: &Connection, pair_id: i64) -> i64 {
    let total_scored: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1 AND last_score IS NOT NULL",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if total_scored == 0 {
        return 0;
    }

    let correct: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM srs_cards WHERE language_pair_id = ?1 AND last_score >= 3",
            [pair_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    ((correct as f64 / total_scored as f64) * 100.0).round() as i64
}

#[derive(Serialize)]
pub struct DeckInfo {
    pub name: String,
    pub card_count: i64,
    pub due_count: i64,
}

#[tauri::command]
pub fn get_decks(state: State<'_, DbState>, pair_id: i64) -> Result<Vec<DeckInfo>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT deck, COUNT(*) as card_count,
                    SUM(CASE WHEN next_review <= date('now') THEN 1 ELSE 0 END) as due_count
             FROM srs_cards WHERE language_pair_id = ?1
             GROUP BY deck ORDER BY deck",
        )
        .map_err(|e| e.to_string())?;

    let decks = stmt
        .query_map([pair_id], |row| {
            Ok(DeckInfo {
                name: row.get(0)?,
                card_count: row.get(1)?,
                due_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(decks)
}

#[tauri::command]
pub fn delete_deck(state: State<'_, DbState>, pair_id: i64, deck: String) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM srs_cards WHERE language_pair_id = ?1 AND deck = ?2",
        rusqlite::params![pair_id, deck],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn sync_vocabulary_markdown(db: &Connection, pair_id: i64, base_dir: &std::path::Path) -> Result<(), String> {
    let mut stmt = db
        .prepare(
            "SELECT w.source_word, w.target_word, w.gender, w.level,
                    sc.ease_factor, sc.interval_days, sc.next_review, sc.last_score
             FROM srs_cards sc
             JOIN words w ON w.id = sc.word_id
             WHERE sc.language_pair_id = ?1
             ORDER BY w.source_word",
        )
        .map_err(|e| e.to_string())?;

    type VocabRow = (String, String, Option<String>, Option<String>, f64, i64, String, Option<i64>);
    let rows: Vec<VocabRow> = stmt
        .query_map([pair_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut md = String::from("# Learned Vocabulary\n\n");
    md.push_str("| Source | Target | Gender | Level | EF | Interval | Next Review | Last Score |\n");
    md.push_str("|---|---|---|---|---|---|---|---|\n");

    for (src, tgt, gender, level, ef, interval, next, score) in &rows {
        let g = gender.as_deref().unwrap_or("-");
        let l = level.as_deref().unwrap_or("-");
        let s = score.map(|s| s.to_string()).unwrap_or_else(|| "-".to_string());
        md.push_str(&format!(
            "| {} | {} | {} | {} | {:.1} | {}d | {} | {} |\n",
            src, tgt, g, l, ef, interval, next, s
        ));
    }

    let memory_dir = base_dir.join("memory");
    let _ = std::fs::create_dir_all(&memory_dir);
    std::fs::write(memory_dir.join("vocabulary.md"), md)
        .map_err(|e| format!("Failed to write vocabulary.md: {}", e))
}
