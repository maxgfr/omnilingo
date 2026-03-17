use std::path::{Path, PathBuf};
use tauri::State;

use crate::BaseDirState;

fn safe_memory_path(base_dir: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let memory_dir = base_dir.join("memory");
    let full_path = memory_dir.join(rel_path);
    let canonical_base = memory_dir.canonicalize().unwrap_or_else(|_| memory_dir.clone());
    // For new files that don't exist yet, check the parent
    let check_path = if full_path.exists() {
        full_path.canonicalize().unwrap_or_else(|_| full_path.clone())
    } else {
        let parent = full_path.parent().unwrap_or(&memory_dir);
        let parent_canon = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
        parent_canon.join(full_path.file_name().unwrap_or_default())
    };
    if !check_path.starts_with(&canonical_base) {
        return Err("Invalid path: traversal detected".to_string());
    }
    Ok(full_path)
}

#[tauri::command]
pub fn read_memory_file(base_dir: State<'_, BaseDirState>, path: String) -> Result<Option<String>, String> {
    let file_path = safe_memory_path(&base_dir.0, &path)?;
    if !file_path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&file_path)
        .map(Some)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub fn write_memory_file(base_dir: State<'_, BaseDirState>, path: String, content: String) -> Result<(), String> {
    let file_path = safe_memory_path(&base_dir.0, &path)?;
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", path, e))
}
