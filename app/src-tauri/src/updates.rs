//! In-app updates. The UI checks, shows what it found, and installs exactly
//! that update. See docs/release.md and docs/compatibility.md.
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

const TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Default)]
pub struct UpdateState {
    /// The update found by the last check; `install` uses exactly this one.
    found: Mutex<Option<Update>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
    /// Optional `minimumSupportedVersion` from latest.json: a dormant safety
    /// net for security emergencies (docs/decisions/0002-no-forced-updates.md).
    pub required: bool,
    /// Update checks are off in development builds.
    pub disabled_in_dev: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

fn update_error(e: tauri_plugin_updater::Error) -> AppError {
    AppError::Update(format!("Couldn't check for updates: {e}"))
}

pub async fn check(app: &AppHandle, state: &UpdateState) -> AppResult<UpdateInfo> {
    let current_version = app.package_info().version.to_string();
    if cfg!(debug_assertions) {
        return Ok(UpdateInfo {
            available: false,
            current_version,
            version: None,
            notes: None,
            date: None,
            required: false,
            disabled_in_dev: true,
        });
    }
    let updater = app
        .updater_builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(update_error)?;
    let found = updater.check().await.map_err(update_error)?;
    let info = match &found {
        Some(u) => {
            let minimum = u
                .raw_json
                .get("minimumSupportedVersion")
                .and_then(|v| v.as_str())
                .and_then(|v| semver::Version::parse(v.trim_start_matches('v')).ok());
            let current = semver::Version::parse(&current_version).ok();
            UpdateInfo {
                available: true,
                current_version,
                version: Some(u.version.clone()),
                notes: u.body.clone(),
                date: u.date.map(|d| d.date().to_string()),
                required: matches!((minimum, current), (Some(m), Some(c)) if c < m),
                disabled_in_dev: false,
            }
        }
        None => UpdateInfo {
            available: false,
            current_version,
            version: None,
            notes: None,
            date: None,
            required: false,
            disabled_in_dev: false,
        },
    };
    *state.found.lock().await = found;
    Ok(info)
}

/// Downloads, verifies (minisign signature) and runs the MSI found by the
/// last `check`. Emits `update://progress`. On Windows the installer takes
/// over and the app exits when the download completes.
pub async fn install(app: &AppHandle, state: &UpdateState) -> AppResult<()> {
    let update = state
        .found
        .lock()
        .await
        .take()
        .ok_or_else(|| AppError::Update("Please check for updates first.".into()))?;
    let mut downloaded: u64 = 0;
    let emitter = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let _ = emitter.emit("update://progress", Progress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| AppError::Update(format!("The update couldn't be installed: {e}")))
}
