use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::BaseDirState;

#[derive(Serialize)]
pub struct WhisperModelInfo {
    pub name: String,
    pub size_mb: u64,
    pub url: String,
    pub downloaded: bool,
}

fn models_dir(base_dir: &Path) -> PathBuf {
    let dir = base_dir.join("models");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn model_path(base_dir: &Path, model_name: &str) -> PathBuf {
    models_dir(base_dir).join(format!("ggml-{}.bin", model_name))
}

fn model_url(model_name: &str) -> String {
    format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin",
        model_name
    )
}

#[tauri::command]
pub fn get_whisper_models(base_dir: State<'_, BaseDirState>) -> Result<Vec<WhisperModelInfo>, String> {
    let models = vec![("tiny", 75), ("base", 142), ("small", 466)];
    Ok(models
        .into_iter()
        .map(|(name, size)| {
            let path = model_path(&base_dir.0, name);
            WhisperModelInfo {
                name: name.to_string(),
                size_mb: size,
                url: model_url(name),
                downloaded: path.exists(),
            }
        })
        .collect())
}

#[tauri::command]
pub async fn download_whisper_model(
    base_dir: State<'_, BaseDirState>,
    model_name: String,
) -> Result<String, String> {
    let url = model_url(&model_name);
    let path = model_path(&base_dir.0, &model_name);
    if path.exists() {
        return Ok("Model already downloaded".to_string());
    }
    let response = reqwest::get(&url).await.map_err(|e| format!("Download failed: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| format!("Failed to read: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to save: {}", e))?;
    Ok(format!("Downloaded {} ({} MB)", model_name, bytes.len() / 1_000_000))
}

/// Transcribe audio using Whisper (only available with `stt` feature)
#[tauri::command]
pub async fn transcribe_audio(
    base_dir: State<'_, BaseDirState>,
    audio_data: Vec<f32>,
    language: Option<String>,
) -> Result<String, String> {
    #[cfg(feature = "stt")]
    {
        let base = base_dir.0.clone();
        let lang = language.unwrap_or_else(|| "de".to_string());

        let model_file = ["small", "base", "tiny"]
            .iter()
            .map(|name| model_path(&base, name))
            .find(|p| p.exists())
            .ok_or_else(|| "Aucun modèle Whisper téléchargé. Allez dans Paramètres.".to_string())?;

        tauri::async_runtime::spawn_blocking(move || {
            let ctx = whisper_rs::WhisperContext::new_with_params(
                model_file.to_str().unwrap_or(""),
                whisper_rs::WhisperContextParameters::default(),
            )
            .map_err(|e| format!("Whisper load error: {}", e))?;

            let mut state = ctx.create_state().map_err(|e| format!("State error: {}", e))?;
            let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some(&lang));
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_single_segment(true);

            state.full(params, &audio_data).map_err(|e| format!("Transcription failed: {}", e))?;

            let mut text = String::new();
            let n = state.full_n_segments();
            for i in 0..n {
                let seg = state.full_get_segment_text(i).map_err(|e| format!("Segment error: {}", e))?;
                text.push_str(&seg);
            }
            Ok(text.trim().to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }

    #[cfg(not(feature = "stt"))]
    {
        let _ = (base_dir, audio_data, language);
        Err("STT non activé. Recompilez avec: cargo tauri dev --features stt".to_string())
    }
}
