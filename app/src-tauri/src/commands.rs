//! Every command the UI can call. Each one is also listed in build.rs (app
//! ACL manifest) and granted in capabilities/default.json, or the docs
//! generator fails. `command(async)` keeps file I/O off the main thread.
use tauri::{AppHandle, State};

use crate::backup::{self, BackupInfo, BackupReason};
use crate::error::{AppError, AppResult};
use crate::google::auth::{GmailStatus, GoogleAuth};
use crate::google::gmail::{self, DraftCreated};
use crate::google::store::ClientCredentials;
use crate::preferences::{self, Preferences};
use crate::updates::{self, UpdateInfo, UpdateState};

const MAX_SUBJECT: usize = 1_000;
const MAX_BODY: usize = 100_000;

/// Gmail connection status (connected account, whether Gmail is set up).
#[tauri::command]
pub async fn gmail_status(auth: State<'_, GoogleAuth>) -> AppResult<GmailStatus> {
    auth.status()
}

/// Signs in with Google in the browser; resolves when finished, cancelled or timed out.
#[tauri::command]
pub async fn gmail_connect(app: AppHandle, auth: State<'_, GoogleAuth>) -> AppResult<GmailStatus> {
    auth.connect(&app).await
}

/// Cancels a sign-in that is waiting for the browser.
#[tauri::command]
pub fn gmail_cancel_connect(auth: State<'_, GoogleAuth>) {
    auth.cancel_connect();
}

/// Revokes Gmail access and forgets the account on this PC.
#[tauri::command]
pub async fn gmail_disconnect(auth: State<'_, GoogleAuth>) -> AppResult<GmailStatus> {
    auth.disconnect().await
}

/// Saves one invoice as a Gmail draft.
#[tauri::command]
pub async fn gmail_create_draft(
    auth: State<'_, GoogleAuth>,
    subject: String,
    body: String,
) -> AppResult<DraftCreated> {
    if subject.len() > MAX_SUBJECT || body.len() > MAX_BODY {
        return Err(AppError::Invalid(
            "The invoice is too long to save as a draft.".into(),
        ));
    }
    gmail::create_draft(&auth, &subject, &body).await
}

/// Uses the user's own Google OAuth client instead of the built-in one (advanced).
#[tauri::command]
pub async fn gmail_set_custom_client(
    auth: State<'_, GoogleAuth>,
    client_id: String,
    client_secret: String,
) -> AppResult<GmailStatus> {
    let (client_id, client_secret) = (
        client_id.trim().to_string(),
        client_secret.trim().to_string(),
    );
    if !client_id.ends_with(".apps.googleusercontent.com")
        || client_id.len() > 200
        || client_secret.is_empty()
        || client_secret.len() > 200
    {
        return Err(AppError::Invalid(
            "That doesn't look like a Google OAuth client ID and secret.".into(),
        ));
    }
    auth.set_client_override(Some(ClientCredentials {
        client_id,
        client_secret,
    }))
    .await
}

/// Goes back to the built-in Google OAuth client.
#[tauri::command]
pub async fn gmail_clear_custom_client(auth: State<'_, GoogleAuth>) -> AppResult<GmailStatus> {
    auth.set_client_override(None).await
}

/// Checks GitHub for a newer version (disabled in development builds).
#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> AppResult<UpdateInfo> {
    updates::check(&app, &state).await
}

/// Downloads and installs the update found by the last check; the app then exits.
#[tauri::command]
pub async fn install_update(app: AppHandle, state: State<'_, UpdateState>) -> AppResult<()> {
    updates::install(&app, &state).await
}

/// Asks where to save and writes an export of all data; returns the file name, or null if cancelled.
#[tauri::command]
pub async fn export_backup(
    app: AppHandle,
    content: String,
    suggested_name: String,
) -> AppResult<Option<String>> {
    backup::export(&app, content, suggested_name).await
}

/// Asks for a backup file and returns its contents, or null if cancelled.
#[tauri::command]
pub async fn import_backup(app: AppHandle) -> AppResult<Option<String>> {
    backup::import(&app).await
}

/// Saves an automatic backup in the app's backups folder.
#[tauri::command(async)]
pub fn create_auto_backup(
    app: AppHandle,
    reason: BackupReason,
    content: String,
) -> AppResult<BackupInfo> {
    backup::create_auto(&app, reason, &content)
}

/// Lists automatic backups, newest first.
#[tauri::command(async)]
pub fn list_backups(app: AppHandle) -> AppResult<Vec<BackupInfo>> {
    backup::list(&app)
}

/// Reads one automatic backup by name.
#[tauri::command(async)]
pub fn read_backup(app: AppHandle, name: String) -> AppResult<String> {
    backup::read(&app, &name)
}

/// Opens the automatic backups folder in File Explorer.
#[tauri::command(async)]
pub fn open_backups_folder(app: AppHandle) -> AppResult<()> {
    backup::open_folder(&app)
}

/// Device preferences (e.g. low memory mode).
#[tauri::command(async)]
pub fn get_preferences(app: AppHandle) -> Preferences {
    preferences::load(&app)
}

/// Turns low memory mode on or off; takes effect after a restart.
#[tauri::command(async)]
pub fn set_low_memory_mode(app: AppHandle, enabled: bool) -> AppResult<Preferences> {
    let mut prefs = preferences::load(&app);
    prefs.low_memory_mode = enabled;
    preferences::save(&app, &prefs)?;
    Ok(prefs)
}

/// Restarts the app (used to apply low memory mode).
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}
