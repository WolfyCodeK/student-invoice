//! Moving data between PCs (export/import) and automatic local backups.
//!
//! The webview never supplies a file path: export and import open the native
//! file dialog here in Rust, and automatic backups live in a fixed folder
//! (`%LOCALAPPDATA%\com.isaac.student-invoice\backups`) addressed by name
//! only. The file format is defined and fully validated on the TypeScript
//! side (app/src/lib/backup.ts); Rust checks size, encoding and the envelope.
//! See docs/backup.md.
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

use crate::error::{AppError, AppResult};

/// Largest backup file accepted or written.
const MAX_BACKUP_BYTES: usize = 5 * 1024 * 1024;
/// Automatic backups kept per reason; older ones are deleted.
const KEEP_PER_REASON: usize = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BackupReason {
    /// Taken once, before data from an older version is upgraded.
    PreMigration,
    /// Taken before an imported file replaces the current data.
    PreImport,
    /// Taken before an update is installed.
    PreUpdate,
    /// Taken before an automatic backup is restored.
    PreRestore,
    /// Taken at most once a day, on start-up.
    Daily,
}

impl BackupReason {
    fn slug(self) -> &'static str {
        match self {
            BackupReason::PreMigration => "pre-migration",
            BackupReason::PreImport => "pre-import",
            BackupReason::PreUpdate => "pre-update",
            BackupReason::PreRestore => "pre-restore",
            BackupReason::Daily => "daily",
        }
    }

    fn from_slug(slug: &str) -> Option<Self> {
        [
            Self::PreMigration,
            Self::PreImport,
            Self::PreUpdate,
            Self::PreRestore,
            Self::Daily,
        ]
        .into_iter()
        .find(|r| r.slug() == slug)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,
    pub reason: BackupReason,
    /// UTC, ISO 8601.
    pub created_at: String,
    pub size: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Envelope {
    app: String,
    kind: String,
    format_version: u32,
}

/// Checks that `content` is a plausible backup file (size, JSON, envelope).
fn check_content(content: &str) -> AppResult<()> {
    if content.len() > MAX_BACKUP_BYTES {
        return Err(AppError::Invalid(
            "This file is too large to be a Student Invoice backup.".into(),
        ));
    }
    let envelope: Envelope = serde_json::from_str(content)
        .map_err(|_| AppError::Invalid("This file isn't a Student Invoice backup.".into()))?;
    if envelope.app != "student-invoice"
        || envelope.kind != "backup"
        || envelope.format_version == 0
    {
        return Err(AppError::Invalid(
            "This file isn't a Student Invoice backup.".into(),
        ));
    }
    Ok(())
}

/// Decodes a backup file's bytes (UTF-8 only, with an optional byte-order
/// mark) and checks the text with `check_content`.
fn decode(bytes: Vec<u8>) -> AppResult<String> {
    let bytes = bytes
        .strip_prefix(b"\xEF\xBB\xBF")
        .map(<[u8]>::to_vec)
        .unwrap_or(bytes);
    let content = String::from_utf8(bytes).map_err(|_| {
        AppError::Invalid("This file isn't a Student Invoice backup (not UTF-8 text).".into())
    })?;
    check_content(&content)?;
    Ok(content)
}

/// Writes via a temporary file in the same folder, then renames, so a crash
/// never leaves a half-written file under the final name.
fn write_atomic(path: &Path, content: &str) -> AppResult<()> {
    let dir = path
        .parent()
        .ok_or_else(|| AppError::Internal("invalid path".into()))?;
    let tmp = dir.join(format!(
        ".{}.tmp",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup")
    ));
    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(content.as_bytes())?;
        f.sync_all()?;
        fs::rename(&tmp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result.map_err(|e| AppError::Internal(format!("couldn't save the file: {e}")))
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Waits for a native file dialog to close; `None` if the user cancelled.
async fn chosen_path(
    rx: oneshot::Receiver<Option<FilePath>>,
    dialog: &str,
) -> AppResult<Option<PathBuf>> {
    let chosen = rx
        .await
        .map_err(|_| AppError::Internal(format!("the {dialog} dialog closed unexpectedly")))?;
    chosen
        .map(|p| p.into_path().map_err(|e| AppError::Internal(e.to_string())))
        .transpose()
}

/// Asks where to save, then writes the export. `None` if the user cancels.
pub async fn export(
    app: &AppHandle,
    content: String,
    suggested_name: String,
) -> AppResult<Option<String>> {
    check_content(&content)?;
    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .set_title("Export your Student Invoice data")
        .add_filter("Student Invoice backup", &["json"])
        .set_file_name(sanitize_file_name(&suggested_name))
        .save_file(move |p| {
            let _ = tx.send(p);
        });
    let Some(mut path) = chosen_path(rx, "save").await? else {
        return Ok(None);
    };
    if !path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("json"))
    {
        path.set_extension("json");
    }
    write_atomic(&path, &content)?;
    Ok(Some(file_name(&path)))
}

/// Asks which file to import and returns its text. `None` if the user cancels.
pub async fn import(app: &AppHandle) -> AppResult<Option<String>> {
    let (tx, rx) = oneshot::channel();
    app.dialog()
        .file()
        .set_title("Import Student Invoice data")
        .add_filter("Student Invoice backup", &["json"])
        .pick_file(move |p| {
            let _ = tx.send(p);
        });
    let Some(path) = chosen_path(rx, "open").await? else {
        return Ok(None);
    };
    let size = fs::metadata(&path)
        .map_err(|e| AppError::Invalid(format!("couldn't read the file: {e}")))?
        .len();
    if size > MAX_BACKUP_BYTES as u64 {
        return Err(AppError::Invalid(
            "This file is too large to be a Student Invoice backup.".into(),
        ));
    }
    let bytes =
        fs::read(&path).map_err(|e| AppError::Invalid(format!("couldn't read the file: {e}")))?;
    decode(bytes).map(Some)
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !r#"<>:"/\|?*"#.contains(*c) && !c.is_control())
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.');
    if trimmed.is_empty() {
        "Student Invoice backup.json".into()
    } else {
        trimmed.chars().take(120).collect()
    }
}

// ---------------------------------------------------------------------------
// Automatic backups

/// Development builds keep their own folder so testing never mixes with the
/// installed app's backups (they share the same app data directory).
const BACKUPS_FOLDER: &str = if cfg!(debug_assertions) {
    "backups-dev"
} else {
    "backups"
};

fn backups_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join(BACKUPS_FOLDER);
    fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("couldn't create the backups folder: {e}")))?;
    Ok(dir)
}

/// `20260926T153000Z` for the current UTC time.
fn timestamp_now() -> String {
    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_timestamp(secs)
}

fn format_timestamp(unix_secs: u64) -> String {
    let days = (unix_secs / 86_400) as i64;
    let rem = unix_secs % 86_400;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}{m:02}{d:02}T{:02}{:02}{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

/// Days since 1970-01-01 to (year, month, day). Howard Hinnant's algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// Parses an automatic-backup file name: `<timestamp>-<reason>.json`.
/// Anything else (including path separators) is rejected.
fn parse_backup_name(name: &str) -> Option<(String, BackupReason)> {
    let stem = name.strip_suffix(".json")?;
    let (ts, slug) = stem.split_at_checked(16)?;
    let slug = slug.strip_prefix('-')?;
    let b = ts.as_bytes();
    let ok = b.len() == 16
        && b[..8].iter().all(u8::is_ascii_digit)
        && b[8] == b'T'
        && b[9..15].iter().all(u8::is_ascii_digit)
        && b[15] == b'Z';
    if !ok {
        return None;
    }
    let created = format!(
        "{}-{}-{}T{}:{}:{}Z",
        &ts[0..4],
        &ts[4..6],
        &ts[6..8],
        &ts[9..11],
        &ts[11..13],
        &ts[13..15]
    );
    BackupReason::from_slug(slug).map(|r| (created, r))
}

/// Commands run off the main thread, so two automatic backups could be
/// taken at once; this keeps writing and pruning one at a time.
static WRITING: Mutex<()> = Mutex::new(());

pub fn create_auto(app: &AppHandle, reason: BackupReason, content: &str) -> AppResult<BackupInfo> {
    check_content(content)?;
    let _writing = WRITING.lock().unwrap_or_else(PoisonError::into_inner);
    let dir = backups_dir(app)?;
    // Same reason within the same second means the same data: overwrite.
    let name = format!("{}-{}.json", timestamp_now(), reason.slug());
    write_atomic(&dir.join(&name), content)?;
    prune(&dir, reason);
    let (created_at, reason) = parse_backup_name(&name).unwrap_or((String::new(), reason));
    Ok(BackupInfo {
        size: content.len() as u64,
        name,
        reason,
        created_at,
    })
}

/// Keeps the newest `KEEP_PER_REASON` backups of one kind.
fn prune(dir: &Path, reason: BackupReason) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().into_owned()))
        .filter(|n| parse_backup_name(n).is_some_and(|(_, r)| r == reason))
        .collect();
    names.sort();
    let excess = names.len().saturating_sub(KEEP_PER_REASON);
    for old in &names[..excess] {
        let _ = fs::remove_file(dir.join(old));
    }
}

pub fn list(app: &AppHandle) -> AppResult<Vec<BackupInfo>> {
    let dir = backups_dir(app)?;
    let mut out: Vec<BackupInfo> = fs::read_dir(&dir)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let (created_at, reason) = parse_backup_name(&name)?;
            let size = e.metadata().ok()?.len();
            Some(BackupInfo {
                name,
                reason,
                created_at,
                size,
            })
        })
        .collect();
    out.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(out)
}

pub fn read(app: &AppHandle, name: &str) -> AppResult<String> {
    if parse_backup_name(name).is_none() {
        return Err(AppError::Invalid("Unknown backup.".into()));
    }
    let path = backups_dir(app)?.join(name);
    let bytes =
        fs::read(&path).map_err(|_| AppError::Invalid("That backup no longer exists.".into()))?;
    if bytes.len() > MAX_BACKUP_BYTES {
        return Err(AppError::Invalid("This backup is too large.".into()));
    }
    decode(bytes)
}

pub fn open_folder(app: &AppHandle) -> AppResult<()> {
    let dir = backups_dir(app)?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| AppError::Internal(format!("couldn't open the folder: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"{"app":"student-invoice","kind":"backup","formatVersion":1,"data":{}}"#;

    #[test]
    fn envelope_checks() {
        assert!(check_content(VALID).is_ok());
        assert!(check_content(r#"{"app":"other","kind":"backup","formatVersion":1}"#).is_err());
        assert!(
            check_content(r#"{"app":"student-invoice","kind":"backup","formatVersion":0}"#)
                .is_err()
        );
        assert!(check_content("not json").is_err());
        assert!(check_content(&"x".repeat(MAX_BACKUP_BYTES + 1)).is_err());
    }

    #[test]
    fn decode_strips_bom_and_rejects_non_utf8() {
        let mut with_bom = b"\xEF\xBB\xBF".to_vec();
        with_bom.extend_from_slice(VALID.as_bytes());
        assert_eq!(decode(with_bom).unwrap(), VALID);
        assert!(decode(vec![0xFF, 0xFE, 0x00]).is_err());
    }

    #[test]
    fn timestamps() {
        assert_eq!(format_timestamp(0), "19700101T000000Z");
        assert_eq!(format_timestamp(1_790_000_000), "20260921T141320Z");
        assert_eq!(format_timestamp(951_782_400), "20000229T000000Z"); // leap day
    }

    #[test]
    fn backup_names_are_strict() {
        assert_eq!(
            parse_backup_name("20260926T153000Z-pre-import.json"),
            Some(("2026-09-26T15:30:00Z".into(), BackupReason::PreImport))
        );
        assert!(parse_backup_name("20260926T153000Z-daily.json").is_some());
        assert!(parse_backup_name("../20260926T153000Z-daily.json").is_none());
        assert!(parse_backup_name("20260926T153000Z-daily.json.exe").is_none());
        assert!(parse_backup_name("20260926T153000Z-unknown.json").is_none());
        assert!(parse_backup_name("2026092xT153000Z-daily.json").is_none());
        assert!(parse_backup_name("..\\x.json").is_none());
    }

    #[test]
    fn file_names_are_sanitized() {
        assert_eq!(sanitize_file_name("a/b\\c:d*.json"), "abcd.json");
        assert_eq!(sanitize_file_name("  "), "Student Invoice backup.json");
    }
}
