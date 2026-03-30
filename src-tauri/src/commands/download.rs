use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{BaseDirState, DbState};

#[derive(Serialize, Deserialize, Clone)]
pub struct DictionarySource {
    pub source_lang: String,
    pub target_lang: String,
    pub source_name: String,
    pub target_name: String,
    pub source_flag: String,
    pub target_flag: String,
    pub provider: String,
    pub url: String,
    pub format: String,
    pub word_count: Option<i64>,
    pub size_mb: Option<f64>,
}

/// Get the catalog of available dictionaries from the bundled manifest
#[tauri::command]
pub fn get_available_dictionaries(
    base_dir: State<'_, BaseDirState>,
) -> Result<Vec<DictionarySource>, String> {
    let manifest_path = base_dir.0.join("data/dictionary-sources.json");
    if !manifest_path.exists() {
        return Ok(vec![]);
    }

    let data = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: serde_json::Value =
        serde_json::from_str(&data).map_err(|e| format!("Invalid manifest: {}", e))?;

    let mut sources = Vec::new();

    // Extract dictionary entries (object with numeric keys or array)
    if let Some(dicts) = manifest.get("dictionaries") {
        let entries: Vec<&serde_json::Value> = if let Some(arr) = dicts.as_array() {
            arr.iter().collect()
        } else if let Some(obj) = dicts.as_object() {
            obj.values().collect()
        } else {
            vec![]
        };

        for entry in entries {
            if let (Some(src), Some(tgt)) = (
                entry["source_lang"].as_str(),
                entry["target_lang"].as_str(),
            ) {
                sources.push(DictionarySource {
                    source_lang: src.to_string(),
                    target_lang: tgt.to_string(),
                    source_name: entry["source_name"].as_str().unwrap_or(src).to_string(),
                    target_name: entry["target_name"].as_str().unwrap_or(tgt).to_string(),
                    source_flag: entry["source_flag"].as_str().map(|s| s.to_string()).unwrap_or_else(|| lang_to_flag(src)),
                    target_flag: entry["target_flag"].as_str().map(|s| s.to_string()).unwrap_or_else(|| lang_to_flag(tgt)),
                    provider: entry["source"].as_str().unwrap_or("freedict").to_string(),
                    url: entry["url"].as_str().unwrap_or("").to_string(),
                    format: entry["format"].as_str().unwrap_or("stardict").to_string(),
                    word_count: entry["word_count"].as_i64(),
                    size_mb: entry["size_mb"].as_f64(),
                });
            }
        }
    }

    Ok(sources)
}

/// Download a dictionary and create the language pair + import words
#[tauri::command]
pub async fn download_dictionary(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    source_lang: String,
    target_lang: String,
    url: String,
    source_name: String,
    target_name: String,
) -> Result<String, String> {
    if url.is_empty() {
        return Err("No download URL provided".to_string());
    }

    if !url.starts_with("https://") {
        return Err("Only HTTPS URLs are allowed for dictionary downloads".to_string());
    }

    // Download the archive
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read: {}", e))?;

    // Save to downloads dir
    let downloads_dir = base_dir.0.join("downloads");
    let _ = std::fs::create_dir_all(&downloads_dir);
    let filename = format!("{}-{}.stardict.tar.xz", source_lang, target_lang);
    let archive_path = downloads_dir.join(&filename);
    std::fs::write(&archive_path, &bytes)
        .map_err(|e| format!("Failed to save: {}", e))?;

    // Create or get language pair
    let db = state.0.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT OR IGNORE INTO language_pairs (source_lang, target_lang, source_name, target_name, source_flag, target_flag)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            source_lang,
            target_lang,
            source_name,
            target_name,
            lang_to_flag(&source_lang),
            lang_to_flag(&target_lang),
        ],
    )
    .map_err(|e| e.to_string())?;

    let pair_id: i64 = db
        .query_row(
            "SELECT id FROM language_pairs WHERE source_lang = ?1 AND target_lang = ?2",
            rusqlite::params![source_lang, target_lang],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Create dictionary pack record
    db.execute(
        "INSERT INTO dictionary_packs (language_pair_id, source, version) VALUES (?1, 'freedict', '1.0')",
        [pair_id],
    )
    .map_err(|e| e.to_string())?;

    let _pack_id = db.last_insert_rowid();

    // Note: Full StarDict parsing would go here.
    // For now, record the download. StarDict parsing is complex (binary .idx + .dict).
    // The archive is saved for future processing.

    Ok(format!(
        "Dictionary {}-{} downloaded ({:.1} MB). Language pair created.",
        source_lang,
        target_lang,
        bytes.len() as f64 / 1_000_000.0
    ))
}

fn lang_to_flag(lang: &str) -> String {
    match lang {
        "de" | "deu" => "\u{1F1E9}\u{1F1EA}".to_string(), // 🇩🇪
        "fr" | "fra" => "\u{1F1EB}\u{1F1F7}".to_string(), // 🇫🇷
        "en" | "eng" => "\u{1F1EC}\u{1F1E7}".to_string(), // 🇬🇧
        "es" | "spa" => "\u{1F1EA}\u{1F1F8}".to_string(), // 🇪🇸
        "it" | "ita" => "\u{1F1EE}\u{1F1F9}".to_string(), // 🇮🇹
        "pt" | "por" => "\u{1F1F5}\u{1F1F9}".to_string(), // 🇵🇹
        "nl" | "nld" => "\u{1F1F3}\u{1F1F1}".to_string(), // 🇳🇱
        "ru" | "rus" => "\u{1F1F7}\u{1F1FA}".to_string(), // 🇷🇺
        "ja" | "jpn" => "\u{1F1EF}\u{1F1F5}".to_string(), // 🇯🇵
        "zh" | "zho" => "\u{1F1E8}\u{1F1F3}".to_string(), // 🇨🇳
        "ko" | "kor" => "\u{1F1F0}\u{1F1F7}".to_string(), // 🇰🇷
        "ar" | "ara" => "\u{1F1F8}\u{1F1E6}".to_string(), // 🇸🇦
        "tr" | "tur" => "\u{1F1F9}\u{1F1F7}".to_string(), // 🇹🇷
        "pl" | "pol" => "\u{1F1F5}\u{1F1F1}".to_string(), // 🇵🇱
        "sv" | "swe" => "\u{1F1F8}\u{1F1EA}".to_string(), // 🇸🇪
        "da" | "dan" => "\u{1F1E9}\u{1F1F0}".to_string(), // 🇩🇰
        "fi" | "fin" => "\u{1F1EB}\u{1F1EE}".to_string(), // 🇫🇮
        "no" | "nor" | "nob" | "nno" => "\u{1F1F3}\u{1F1F4}".to_string(), // 🇳🇴
        "el" | "ell" => "\u{1F1EC}\u{1F1F7}".to_string(), // 🇬🇷
        "cs" | "ces" => "\u{1F1E8}\u{1F1FF}".to_string(), // 🇨🇿
        "hu" | "hun" => "\u{1F1ED}\u{1F1FA}".to_string(), // 🇭🇺
        "ro" | "ron" => "\u{1F1F7}\u{1F1F4}".to_string(), // 🇷🇴
        "uk" | "ukr" => "\u{1F1FA}\u{1F1E6}".to_string(), // 🇺🇦
        "hi" | "hin" => "\u{1F1EE}\u{1F1F3}".to_string(), // 🇮🇳
        "th" | "tha" => "\u{1F1F9}\u{1F1ED}".to_string(), // 🇹🇭
        "vi" | "vie" => "\u{1F1FB}\u{1F1F3}".to_string(), // 🇻🇳
        "id" | "ind" => "\u{1F1EE}\u{1F1E9}".to_string(), // 🇮🇩
        _ => "\u{1F310}".to_string(),                       // 🌐
    }
}
