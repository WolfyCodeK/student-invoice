//! Device-level preferences that must be known before the window exists, so
//! they can't live in the webview's localStorage. Stored as JSON in the app's
//! local data folder. They belong to this PC and are not part of exports.
//! See docs/performance.md ("Low memory mode").
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// WebView2 arguments wry uses by default; custom arguments replace them, so
/// they are always included.
const DEFAULT_BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

/// Development builds keep their own file (the data folder is shared).
const FILE_NAME: &str = if cfg!(debug_assertions) {
    "preferences-dev.json"
} else {
    "preferences.json"
};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    /// Render without the GPU: roughly 40 % less memory, at some cost to
    /// smoothness on high-resolution screens. Applies after a restart.
    pub low_memory_mode: bool,
}

fn path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dir.join(FILE_NAME))
}

/// The saved preferences; defaults if the file is missing or unreadable.
pub fn load(app: &AppHandle) -> Preferences {
    path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, prefs: &Preferences) -> AppResult<()> {
    let p = path(app)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let json =
        serde_json::to_string_pretty(prefs).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(&p, json).map_err(|e| AppError::Internal(format!("couldn't save preferences: {e}")))
}

/// WebView2 command-line arguments for these preferences.
pub fn browser_args(prefs: Preferences) -> String {
    if prefs.low_memory_mode {
        format!("{DEFAULT_BROWSER_ARGS} --disable-gpu")
    } else {
        DEFAULT_BROWSER_ARGS.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_args_keep_defaults() {
        assert_eq!(browser_args(Preferences::default()), DEFAULT_BROWSER_ARGS);
        let low = browser_args(Preferences {
            low_memory_mode: true,
        });
        assert!(low.starts_with(DEFAULT_BROWSER_ARGS) && low.ends_with("--disable-gpu"));
    }

    #[test]
    fn parsing_is_forgiving() {
        let p: Preferences = serde_json::from_str("{}").unwrap();
        assert_eq!(p, Preferences::default());
        let p: Preferences =
            serde_json::from_str(r#"{"lowMemoryMode":true,"futureField":1}"#).unwrap();
        assert!(p.low_memory_mode);
    }
}
