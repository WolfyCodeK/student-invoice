//! Device-level preferences that must be known before the window exists, so
//! they can't live in the webview's localStorage. Stored as JSON in the app's
//! local data folder. They belong to this PC and are not part of exports.
//! See docs/performance.md ("Low memory mode").
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::backup::write_atomic;
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

/// The saved preferences: the format of preferences.json.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    /// Render without the GPU: roughly 40 % less memory, at some cost to
    /// smoothness on high-resolution screens. Applies after a restart.
    pub low_memory_mode: bool,
}

/// The preferences the running window was started with. Managed state, set
/// once by `create_main_window` before the window exists.
pub struct Running(pub Preferences);

/// What the UI is told: the saved choice, and what is actually in effect.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesStatus {
    /// The saved choice; the next start uses it.
    pub low_memory_mode: bool,
    /// What the running window was started with.
    pub low_memory_mode_active: bool,
}

impl PreferencesStatus {
    fn new(saved: Preferences, running: Preferences) -> Self {
        Self {
            low_memory_mode: saved.low_memory_mode,
            low_memory_mode_active: running.low_memory_mode,
        }
    }
}

/// `saved` together with what the running window was started with.
pub fn status(app: &AppHandle, saved: Preferences) -> PreferencesStatus {
    // Always set before the window (and so the UI) exists.
    let running = app.try_state::<Running>().map_or(saved, |r| r.0);
    PreferencesStatus::new(saved, running)
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

/// Saves atomically, so a crash can't leave a half-written file.
pub fn save(app: &AppHandle, prefs: &Preferences) -> AppResult<()> {
    let p = path(app)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let json =
        serde_json::to_string_pretty(prefs).map_err(|e| AppError::Internal(e.to_string()))?;
    write_atomic(&p, &json)
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

    #[test]
    fn file_format_is_unchanged() {
        let json = serde_json::to_value(Preferences {
            low_memory_mode: true,
        })
        .unwrap();
        assert_eq!(json, serde_json::json!({ "lowMemoryMode": true }));
    }

    #[test]
    fn status_reports_saved_and_running_choices() {
        let on = Preferences {
            low_memory_mode: true,
        };
        let off = Preferences::default();
        // Turned on in Settings, not restarted yet.
        let json = serde_json::to_value(PreferencesStatus::new(on, off)).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "lowMemoryMode": true, "lowMemoryModeActive": false })
        );
        let status = PreferencesStatus::new(off, on);
        assert!(!status.low_memory_mode && status.low_memory_mode_active);
    }
}
