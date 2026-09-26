//! Every command the UI can call. Each one must also be listed in build.rs
//! (app ACL manifest) and granted in capabilities/default.json; the docs
//! generator fails if the three lists disagree.
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::google::auth::{GmailStatus, GoogleAuth};
use crate::google::gmail::{self, DraftCreated};
use crate::google::mime;
use crate::google::store::ClientCredentials;
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

/// Saves one invoice as a Gmail draft (optionally addressed to `to`).
#[tauri::command]
pub async fn gmail_create_draft(
    auth: State<'_, GoogleAuth>,
    subject: String,
    body: String,
    to: Option<String>,
) -> AppResult<DraftCreated> {
    if subject.len() > MAX_SUBJECT || body.len() > MAX_BODY {
        return Err(AppError::Invalid(
            "The invoice is too long to save as a draft.".into(),
        ));
    }
    let to = to.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    if let Some(t) = &to {
        if !mime::valid_recipients(t) {
            return Err(AppError::Invalid(format!(
                "\"{t}\" isn't a valid email address."
            )));
        }
    }
    gmail::create_draft(&auth, to.as_deref(), &subject, &body).await
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
