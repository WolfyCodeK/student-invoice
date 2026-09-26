//! Gmail API calls: create a draft, and read the signed-in address.
use serde::Deserialize;

use super::auth::GoogleAuth;
use super::mime;
use crate::error::{AppError, AppResult};

const DRAFTS_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
const PROFILE_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftCreated {
    pub id: String,
}

#[derive(Deserialize)]
struct DraftResponse {
    id: String,
}

#[derive(Deserialize)]
struct GoogleErrorBody {
    error: GoogleErrorDetail,
}

#[derive(Deserialize)]
struct GoogleErrorDetail {
    message: String,
}

async fn google_error(response: reqwest::Response) -> AppError {
    let status = response.status();
    let message = response
        .json::<GoogleErrorBody>()
        .await
        .map(|b| b.error.message)
        .unwrap_or_else(|_| status.to_string());
    AppError::Google(message.chars().take(300).collect())
}

/// Saves one invoice as a Gmail draft. On a 401 the access token is refreshed
/// and the request retried once.
pub async fn create_draft(
    auth: &GoogleAuth,
    to: Option<&str>,
    subject: &str,
    body: &str,
) -> AppResult<DraftCreated> {
    let payload = serde_json::json!({ "message": { "raw": mime::raw_message(to, subject, body) } });
    let mut token = auth.access_token(false).await?;
    for attempt in 0..2 {
        let response = auth
            .http()
            .post(DRAFTS_URL)
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED && attempt == 0 {
            token = auth.access_token(true).await?;
            continue;
        }
        if !response.status().is_success() {
            return Err(google_error(response).await);
        }
        let draft: DraftResponse = response
            .json()
            .await
            .map_err(|_| AppError::Google("unexpected response from Gmail".into()))?;
        return Ok(DraftCreated { id: draft.id });
    }
    Err(AppError::ReauthRequired)
}

/// The Gmail address of the signed-in account (shown as "Connected as …").
pub async fn profile_email(http: &reqwest::Client, access_token: &str) -> AppResult<String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Profile {
        email_address: String,
    }
    let response = http
        .get(PROFILE_URL)
        .bearer_auth(access_token)
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(google_error(response).await);
    }
    Ok(response
        .json::<Profile>()
        .await
        .map_err(|_| AppError::Google("unexpected response from Gmail".into()))?
        .email_address)
}
