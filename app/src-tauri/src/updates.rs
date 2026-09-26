//! In-app updates. The UI checks, shows what it found, and installs exactly
//! that update. See docs/release.md and docs/compatibility.md.
use std::sync::{Mutex as StdMutex, PoisonError};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

const TIMEOUT: Duration = Duration::from_secs(60);
/// How often `update://progress` may fire when the download size is unknown.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

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

impl UpdateInfo {
    fn not_available(current_version: String, disabled_in_dev: bool) -> Self {
        Self {
            available: false,
            current_version,
            version: None,
            notes: None,
            date: None,
            required: false,
            disabled_in_dev,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

/// Decides which download chunks are reported, so the UI gets a handful of
/// `update://progress` events rather than one per chunk: one per whole
/// percent when the size is known, otherwise at most one per
/// `PROGRESS_INTERVAL`. `finish` reports the final state if it was held back.
#[derive(Default)]
struct ProgressThrottle {
    downloaded: u64,
    total: Option<u64>,
    /// Bytes downloaded, and when, at the last reported chunk.
    reported: Option<(u64, Instant)>,
}

impl ProgressThrottle {
    /// Counts a chunk; returns the progress to report, if it is due.
    fn chunk(&mut self, len: usize, total: Option<u64>, now: Instant) -> Option<Progress> {
        self.downloaded += len as u64;
        self.total = total;
        let due = match (self.reported, total) {
            (None, _) => true,
            (Some((before, _)), Some(t)) if t > 0 => before * 100 / t != self.downloaded * 100 / t,
            (Some((_, at)), _) => now.duration_since(at) >= PROGRESS_INTERVAL,
        };
        due.then(|| self.report(now))
    }

    /// The final progress, unless it has already been reported.
    fn finish(&mut self, now: Instant) -> Option<Progress> {
        let held_back = self
            .reported
            .is_some_and(|(before, _)| before != self.downloaded);
        held_back.then(|| self.report(now))
    }

    fn report(&mut self, now: Instant) -> Progress {
        self.reported = Some((self.downloaded, now));
        Progress {
            downloaded: self.downloaded,
            total: self.total,
        }
    }
}

fn update_error(e: tauri_plugin_updater::Error) -> AppError {
    AppError::Update(format!("Couldn't check for updates: {e}"))
}

/// True when latest.json names a `minimumSupportedVersion` above the running
/// version: the dormant safety net for security emergencies
/// (docs/decisions/0002-no-forced-updates.md). Anything unreadable counts as
/// "not required", so a malformed field can never lock users out.
fn below_minimum(raw_json: &serde_json::Value, current_version: &str) -> bool {
    let minimum = raw_json
        .get("minimumSupportedVersion")
        .and_then(|v| v.as_str())
        .and_then(|v| semver::Version::parse(v.trim().trim_start_matches('v')).ok());
    let current = semver::Version::parse(current_version).ok();
    matches!((minimum, current), (Some(m), Some(c)) if c < m)
}

pub async fn check(app: &AppHandle, state: &UpdateState) -> AppResult<UpdateInfo> {
    let current_version = app.package_info().version.to_string();
    if cfg!(debug_assertions) {
        return Ok(UpdateInfo::not_available(current_version, true));
    }
    let updater = app
        .updater_builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(update_error)?;
    let found = updater.check().await.map_err(update_error)?;
    let info = match &found {
        Some(u) => {
            let required = below_minimum(&u.raw_json, &current_version);
            UpdateInfo {
                available: true,
                current_version,
                version: Some(u.version.clone()),
                notes: u.body.clone(),
                date: u.date.map(|d| d.date().to_string()),
                required,
                disabled_in_dev: false,
            }
        }
        None => UpdateInfo::not_available(current_version, false),
    };
    *state.found.lock().await = found;
    Ok(info)
}

/// Downloads, verifies (minisign signature) and runs the MSI found by the
/// last `check`. Emits `update://progress` (throttled, see
/// `ProgressThrottle`). On Windows the installer takes over and the app exits
/// when the download completes.
pub async fn install(app: &AppHandle, state: &UpdateState) -> AppResult<()> {
    let update = state
        .found
        .lock()
        .await
        .take()
        .ok_or_else(|| AppError::Update("Please check for updates first.".into()))?;
    // Shared by both callbacks; a std mutex keeps them `Send`.
    let throttle = StdMutex::new(ProgressThrottle::default());
    let lock = || throttle.lock().unwrap_or_else(PoisonError::into_inner);
    let emit = |progress: Option<Progress>| {
        if let Some(progress) = progress {
            let _ = app.emit("update://progress", progress);
        }
    };
    update
        .download_and_install(
            |chunk, total| emit(lock().chunk(chunk, total, Instant::now())),
            || emit(lock().finish(Instant::now())),
        )
        .await
        .map_err(|e| AppError::Update(format!("The update couldn't be installed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimum_supported_version() {
        let feed = |min: serde_json::Value| serde_json::json!({ "version": "1.2.0", "minimumSupportedVersion": min });
        assert!(below_minimum(&feed("1.1.1".into()), "1.1.0"));
        assert!(below_minimum(&feed("v1.1.1".into()), "1.0.1"));
        assert!(!below_minimum(&feed("1.1.0".into()), "1.1.0"));
        assert!(!below_minimum(&feed("1.0.0".into()), "1.1.0"));
        assert!(!below_minimum(
            &serde_json::json!({ "version": "1.2.0" }),
            "1.0.1"
        ));
        assert!(!below_minimum(&feed("not a version".into()), "1.0.1"));
        assert!(!below_minimum(&feed(serde_json::json!(2)), "1.0.1"));
    }

    fn progress(downloaded: u64, total: Option<u64>) -> Option<Progress> {
        Some(Progress { downloaded, total })
    }

    #[test]
    fn known_size_reports_each_whole_percent_once() {
        let now = Instant::now();
        let mut t = ProgressThrottle::default();
        let total = Some(1000);
        assert_eq!(t.chunk(3, total, now), progress(3, total)); // first chunk
        assert_eq!(t.chunk(3, total, now), None); // still 0 %
        assert_eq!(t.chunk(4, total, now), progress(10, total)); // 1 %
        assert_eq!(t.chunk(9, total, now), None); // 1.9 %
        assert_eq!(t.chunk(981, total, now), progress(1000, total)); // 100 %
        assert_eq!(t.finish(now), None); // already reported
    }

    #[test]
    fn unknown_size_reports_at_intervals_and_the_final_state() {
        let start = Instant::now();
        let mut t = ProgressThrottle::default();
        assert_eq!(t.chunk(10, None, start), progress(10, None));
        assert_eq!(t.chunk(10, None, start + PROGRESS_INTERVAL / 2), None);
        assert_eq!(
            t.chunk(10, None, start + PROGRESS_INTERVAL),
            progress(30, None)
        );
        assert_eq!(t.chunk(10, None, start + PROGRESS_INTERVAL), None);
        let end = start + PROGRESS_INTERVAL;
        assert_eq!(t.finish(end), progress(40, None));
        assert_eq!(t.finish(end), None);
    }

    #[test]
    fn finish_without_chunks_reports_nothing() {
        assert_eq!(ProgressThrottle::default().finish(Instant::now()), None);
    }

    #[test]
    fn progress_payload_shape_is_unchanged() {
        let json = serde_json::to_value(Progress {
            downloaded: 5,
            total: None,
        })
        .unwrap();
        assert_eq!(json, serde_json::json!({ "downloaded": 5, "total": null }));
    }
}
