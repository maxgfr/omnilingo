use serde::{Deserialize, Serialize};
use std::io::{BufRead, Read};
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
                    source_flag: entry["source_flag"]
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| lang_to_flag(src)),
                    target_flag: entry["target_flag"]
                        .as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| lang_to_flag(tgt)),
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
#[allow(clippy::too_many_arguments)]
pub async fn download_dictionary(
    state: State<'_, DbState>,
    base_dir: State<'_, BaseDirState>,
    source_lang: String,
    target_lang: String,
    url: String,
    source_name: String,
    target_name: String,
    format: String,
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

    let download_size = bytes.len() as f64 / 1_000_000.0;

    // Save to downloads dir
    let downloads_dir = base_dir.0.join("downloads");
    let _ = std::fs::create_dir_all(&downloads_dir);
    let ext = match format.as_str() {
        "tatoeba-tsv" => "tsv.bz2",
        "kaikki-jsonl" => "jsonl.zst",
        _ => "stardict.tar.xz",
    };
    let filename = format!("{}-{}.{}", source_lang, target_lang, ext);
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
        "INSERT INTO dictionary_packs (language_pair_id, source, version) VALUES (?1, ?2, '1.0')",
        rusqlite::params![pair_id, format],
    )
    .map_err(|e| e.to_string())?;

    let pack_id = db.last_insert_rowid();

    // Parse and import words based on format
    let word_count = match format.as_str() {
        "stardict" => parse_stardict(&db, pair_id, pack_id, &bytes)?,
        "tatoeba-tsv" => parse_tatoeba_tsv(&db, pair_id, pack_id, &bytes)?,
        "kaikki-jsonl" => parse_kaikki_jsonl(&db, pair_id, pack_id, &bytes)?,
        other => return Err(format!("Unknown dictionary format: {}", other)),
    };

    // Update dictionary pack word count
    db.execute(
        "UPDATE dictionary_packs SET word_count = ?1 WHERE id = ?2",
        rusqlite::params![word_count, pack_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(format!(
        "Dictionary {}-{} imported: {} words ({:.1} MB)",
        source_lang, target_lang, word_count, download_size
    ))
}

// ─── StarDict parser (.tar.xz containing .ifo + .idx + .dict/.dict.dz) ──────

fn parse_stardict(
    db: &rusqlite::Connection,
    pair_id: i64,
    pack_id: i64,
    archive_bytes: &[u8],
) -> Result<i64, String> {
    // Decompress xz
    let xz_reader = xz2::read::XzDecoder::new(archive_bytes);
    // Untar
    let mut archive = tar::Archive::new(xz_reader);

    let mut ifo_data: Option<String> = None;
    let mut idx_data: Option<Vec<u8>> = None;
    let mut dict_data: Option<Vec<u8>> = None;
    let mut dict_is_dz = false;

    for entry_result in archive.entries().map_err(|e| format!("Failed to read tar: {}", e))? {
        let mut entry = entry_result.map_err(|e| format!("Tar entry error: {}", e))?;
        let path = entry
            .path()
            .map_err(|e| format!("Invalid path: {}", e))?
            .to_string_lossy()
            .to_string();

        if path.ends_with(".ifo") {
            let mut s = String::new();
            entry
                .read_to_string(&mut s)
                .map_err(|e| format!("Failed to read .ifo: {}", e))?;
            ifo_data = Some(s);
        } else if path.ends_with(".idx") {
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read .idx: {}", e))?;
            idx_data = Some(buf);
        } else if path.ends_with(".dict.dz") {
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read .dict.dz: {}", e))?;
            dict_data = Some(buf);
            dict_is_dz = true;
        } else if path.ends_with(".dict") {
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read .dict: {}", e))?;
            dict_data = Some(buf);
        }
    }

    let _ifo = ifo_data.ok_or("StarDict archive missing .ifo file")?;
    let idx_bytes = idx_data.ok_or("StarDict archive missing .idx file")?;
    let raw_dict = dict_data.ok_or("StarDict archive missing .dict file")?;

    // Decompress .dict.dz (gzip) if needed
    let dict_bytes = if dict_is_dz {
        let mut decoder = flate2::read::GzDecoder::new(&raw_dict[..]);
        let mut decompressed = Vec::new();
        decoder
            .read_to_end(&mut decompressed)
            .map_err(|e| format!("Failed to decompress .dict.dz: {}", e))?;
        decompressed
    } else {
        raw_dict
    };

    // Parse .idx: sequence of (null-terminated UTF-8 word, u32 offset BE, u32 size BE)
    let entries = parse_idx(&idx_bytes)?;

    // Insert words in a transaction
    let mut count: i64 = 0;
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    {
        let mut stmt = db
            .prepare(
                "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, pack_id, category)
                 VALUES (?1, ?2, ?3, ?4, 'dictionary')",
            )
            .map_err(|e| e.to_string())?;

        for (word, offset, size) in &entries {
            let off = *offset as usize;
            let sz = *size as usize;
            if off + sz > dict_bytes.len() {
                continue; // skip corrupt entries
            }
            let definition_raw = &dict_bytes[off..off + sz];
            let definition = String::from_utf8_lossy(definition_raw);
            // Clean HTML tags and extract first definition
            let clean = strip_html_tags(&definition);
            let target = extract_first_definition(&clean);
            if target.is_empty() || word.is_empty() {
                continue;
            }

            if stmt
                .execute(rusqlite::params![pair_id, word, target, pack_id])
                .is_ok()
            {
                count += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(count)
}

/// Parse a StarDict .idx binary file into (word, offset, size) tuples
fn parse_idx(data: &[u8]) -> Result<Vec<(String, u32, u32)>, String> {
    let mut entries = Vec::new();
    let mut pos = 0;

    while pos < data.len() {
        // Find null terminator for the word string
        let word_end = data[pos..]
            .iter()
            .position(|&b| b == 0)
            .ok_or_else(|| "Invalid .idx: missing null terminator".to_string())?;

        let word = String::from_utf8_lossy(&data[pos..pos + word_end]).to_string();
        pos += word_end + 1; // skip null byte

        // Read offset (4 bytes, big-endian u32)
        if pos + 8 > data.len() {
            break;
        }
        let offset = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        pos += 4;
        // Read size (4 bytes, big-endian u32)
        let size = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        pos += 4;

        entries.push((word, offset, size));
    }

    Ok(entries)
}

/// Strip HTML tags from a string
fn strip_html_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result
}

/// Extract the first meaningful definition from a potentially multi-line definition string
fn extract_first_definition(s: &str) -> String {
    // Definitions may be separated by newlines, semicolons, or numbered lists
    let trimmed = s.trim();
    // Take the first non-empty line
    for line in trimmed.lines() {
        let line = line.trim();
        // Skip empty lines and metadata lines
        if line.is_empty() {
            continue;
        }
        // Strip leading numbering like "1. " or "1) "
        let cleaned = line
            .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ')' || c == ' ');
        if !cleaned.is_empty() {
            // Limit to reasonable length
            return if cleaned.len() > 200 {
                format!("{}...", &cleaned[..197])
            } else {
                cleaned.to_string()
            };
        }
    }
    trimmed
        .chars()
        .take(200)
        .collect::<String>()
        .trim()
        .to_string()
}

// ─── Tatoeba TSV parser (.tsv.bz2) ──────────────────────────────────────────

fn parse_tatoeba_tsv(
    db: &rusqlite::Connection,
    pair_id: i64,
    pack_id: i64,
    compressed_bytes: &[u8],
) -> Result<i64, String> {
    // Decompress bzip2
    let decoder = bzip2::read::BzDecoder::new(compressed_bytes);
    let reader = std::io::BufReader::new(decoder);

    let mut count: i64 = 0;
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    {
        let mut stmt = db
            .prepare(
                "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, pack_id, category)
                 VALUES (?1, ?2, ?3, ?4, 'sentence')",
            )
            .map_err(|e| e.to_string())?;

        for line_result in reader.lines() {
            let line = match line_result {
                Ok(l) => l,
                Err(_) => continue,
            };
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = line.split('\t').collect();
            // Tatoeba formats: either "source\ttarget" or "id\tsource\ttarget" or more columns
            let (source, target) = if parts.len() >= 4 {
                // id \t lang \t source \t target (common Tatoeba sentence pair format)
                (parts[2].trim(), parts[3].trim())
            } else if parts.len() >= 2 {
                (parts[0].trim(), parts[1].trim())
            } else {
                continue;
            };

            if source.is_empty() || target.is_empty() {
                continue;
            }

            if stmt
                .execute(rusqlite::params![pair_id, source, target, pack_id])
                .is_ok()
            {
                count += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(count)
}

// ─── Kaikki JSONL parser (Wiktextract) ───────────────────────────────────────

fn parse_kaikki_jsonl(
    db: &rusqlite::Connection,
    pair_id: i64,
    pack_id: i64,
    raw_bytes: &[u8],
) -> Result<i64, String> {
    // Kaikki files may be plain JSONL or compressed. Try reading as plain text first.
    // If that fails (binary content), try common compression formats.
    let text = match String::from_utf8(raw_bytes.to_vec()) {
        Ok(s) if s.starts_with('{') => s,
        _ => {
            // Try bzip2 decompression
            if let Ok(text) = decompress_and_read_bz2(raw_bytes) {
                text
            } else if let Ok(text) = decompress_and_read_xz(raw_bytes) {
                text
            } else {
                // Try reading as-is (might have BOM or encoding issues)
                String::from_utf8_lossy(raw_bytes).to_string()
            }
        }
    };

    let mut count: i64 = 0;
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    {
        let mut stmt = db
            .prepare(
                "INSERT OR IGNORE INTO words (language_pair_id, source_word, target_word, gender, category, tags, pack_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )
            .map_err(|e| e.to_string())?;

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || !line.starts_with('{') {
                continue;
            }

            let entry: serde_json::Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let word = match entry.get("word").and_then(|v| v.as_str()) {
                Some(w) if !w.is_empty() => w,
                _ => continue,
            };

            let pos = entry
                .get("pos")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // Extract gender from tags if present (for nouns)
            let gender = extract_kaikki_gender(&entry);

            // Extract IPA pronunciation as tags
            let ipa = extract_kaikki_ipa(&entry);

            // Extract definitions from senses
            let definitions = extract_kaikki_definitions(&entry);
            if definitions.is_empty() {
                continue;
            }

            let target = definitions.join("; ");
            let target = if target.len() > 500 {
                format!("{}...", &target[..497])
            } else {
                target
            };

            let category = if pos.is_empty() {
                "dictionary".to_string()
            } else {
                pos
            };

            if stmt
                .execute(rusqlite::params![
                    pair_id, word, target, gender, category, ipa, pack_id
                ])
                .is_ok()
            {
                count += 1;
            }
        }
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(count)
}

fn extract_kaikki_definitions(entry: &serde_json::Value) -> Vec<String> {
    let mut defs = Vec::new();
    if let Some(senses) = entry.get("senses").and_then(|v| v.as_array()) {
        for sense in senses {
            if let Some(glosses) = sense.get("glosses").and_then(|v| v.as_array()) {
                for gloss in glosses {
                    if let Some(text) = gloss.as_str() {
                        let text = text.trim();
                        if !text.is_empty() {
                            defs.push(text.to_string());
                        }
                    }
                }
            }
            // Also check raw_glosses as fallback
            if defs.is_empty() {
                if let Some(glosses) = sense.get("raw_glosses").and_then(|v| v.as_array()) {
                    for gloss in glosses {
                        if let Some(text) = gloss.as_str() {
                            let text = text.trim();
                            if !text.is_empty() {
                                defs.push(text.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    defs
}

fn extract_kaikki_gender(entry: &serde_json::Value) -> Option<String> {
    // Check head_templates or forms for gender info
    if let Some(tags) = entry.get("tags").and_then(|v| v.as_array()) {
        for tag in tags {
            if let Some(t) = tag.as_str() {
                match t {
                    "masculine" => return Some("m".to_string()),
                    "feminine" => return Some("f".to_string()),
                    "neuter" => return Some("n".to_string()),
                    _ => {}
                }
            }
        }
    }
    // Also check forms
    if let Some(forms) = entry.get("forms").and_then(|v| v.as_array()) {
        for form in forms {
            if let Some(tags) = form.get("tags").and_then(|v| v.as_array()) {
                for tag in tags {
                    if let Some(t) = tag.as_str() {
                        match t {
                            "masculine" => return Some("m".to_string()),
                            "feminine" => return Some("f".to_string()),
                            "neuter" => return Some("n".to_string()),
                            _ => {}
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_kaikki_ipa(entry: &serde_json::Value) -> Option<String> {
    if let Some(sounds) = entry.get("sounds").and_then(|v| v.as_array()) {
        for sound in sounds {
            if let Some(ipa) = sound.get("ipa").and_then(|v| v.as_str()) {
                if !ipa.is_empty() {
                    return Some(ipa.to_string());
                }
            }
        }
    }
    None
}

fn decompress_and_read_bz2(data: &[u8]) -> Result<String, String> {
    let decoder = bzip2::read::BzDecoder::new(data);
    let mut reader = std::io::BufReader::new(decoder);
    let mut text = String::new();
    reader
        .read_to_string(&mut text)
        .map_err(|e| format!("BZ2 decompress failed: {}", e))?;
    Ok(text)
}

fn decompress_and_read_xz(data: &[u8]) -> Result<String, String> {
    let decoder = xz2::read::XzDecoder::new(data);
    let mut reader = std::io::BufReader::new(decoder);
    let mut text = String::new();
    reader
        .read_to_string(&mut text)
        .map_err(|e| format!("XZ decompress failed: {}", e))?;
    Ok(text)
}

// ─── Utilities ───────────────────────────────────────────────────────────────

pub fn lang_to_flag(lang: &str) -> String {
    match lang {
        "de" | "deu" => "\u{1F1E9}\u{1F1EA}".to_string(),
        "fr" | "fra" => "\u{1F1EB}\u{1F1F7}".to_string(),
        "en" | "eng" => "\u{1F1EC}\u{1F1E7}".to_string(),
        "es" | "spa" => "\u{1F1EA}\u{1F1F8}".to_string(),
        "it" | "ita" => "\u{1F1EE}\u{1F1F9}".to_string(),
        "pt" | "por" => "\u{1F1F5}\u{1F1F9}".to_string(),
        "nl" | "nld" => "\u{1F1F3}\u{1F1F1}".to_string(),
        "ru" | "rus" => "\u{1F1F7}\u{1F1FA}".to_string(),
        "ja" | "jpn" => "\u{1F1EF}\u{1F1F5}".to_string(),
        "zh" | "zho" => "\u{1F1E8}\u{1F1F3}".to_string(),
        "ko" | "kor" => "\u{1F1F0}\u{1F1F7}".to_string(),
        "ar" | "ara" => "\u{1F1F8}\u{1F1E6}".to_string(),
        "tr" | "tur" => "\u{1F1F9}\u{1F1F7}".to_string(),
        "pl" | "pol" => "\u{1F1F5}\u{1F1F1}".to_string(),
        "sv" | "swe" => "\u{1F1F8}\u{1F1EA}".to_string(),
        "da" | "dan" => "\u{1F1E9}\u{1F1F0}".to_string(),
        "fi" | "fin" => "\u{1F1EB}\u{1F1EE}".to_string(),
        "no" | "nor" | "nob" | "nno" => "\u{1F1F3}\u{1F1F4}".to_string(),
        "el" | "ell" => "\u{1F1EC}\u{1F1F7}".to_string(),
        "cs" | "ces" => "\u{1F1E8}\u{1F1FF}".to_string(),
        "hu" | "hun" => "\u{1F1ED}\u{1F1FA}".to_string(),
        "ro" | "ron" => "\u{1F1F7}\u{1F1F4}".to_string(),
        "uk" | "ukr" => "\u{1F1FA}\u{1F1E6}".to_string(),
        "hi" | "hin" => "\u{1F1EE}\u{1F1F3}".to_string(),
        "th" | "tha" => "\u{1F1F9}\u{1F1ED}".to_string(),
        "vi" | "vie" => "\u{1F1FB}\u{1F1F3}".to_string(),
        "id" | "ind" => "\u{1F1EE}\u{1F1E9}".to_string(),
        _ => "\u{1F310}".to_string(),
    }
}
