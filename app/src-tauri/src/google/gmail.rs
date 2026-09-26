//! Gmail API calls: create a draft, and read the signed-in address.
use serde::de::DeserializeOwned;
use serde::Deserialize;

use super::auth::GoogleAuth;
use super::mime;
use crate::error::{AppError, AppResult};

const DRAFTS_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
const PROFILE_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

/// The saved draft, read straight from Gmail's response (only `id` is used).
#[derive(Debug, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftCreated {
    pub id: String,
}

#[derive(Deserialize)]
struct GoogleErrorBody {
    error: GoogleErrorDetail,
}

#[derive(Deserialize)]
struct GoogleErrorDetail {
    message: String,
}

/// The JSON body of a successful response, or Google's error message
/// (trimmed to 300 characters).
async fn json_body<T: DeserializeOwned>(response: reqwest::Response) -> AppResult<T> {
    let status = response.status();
    if !status.is_success() {
        let message = response
            .json::<GoogleErrorBody>()
            .await
            .map(|b| b.error.message)
            .unwrap_or_else(|_| status.to_string());
        return Err(AppError::Google(message.chars().take(300).collect()));
    }
    response
        .json()
        .await
        .map_err(|_| AppError::Google("unexpected response from Gmail".into()))
}

/// Saves one invoice as a Gmail draft. On a 401 the access token is refreshed
/// and the request retried once.
pub async fn create_draft(auth: &GoogleAuth, subject: &str, body: &str) -> AppResult<DraftCreated> {
    let payload = serde_json::json!({ "message": { "raw": mime::raw_message(subject, body) } });
    let send = |token: String| {
        auth.http()
            .post(DRAFTS_URL)
            .bearer_auth(token)
            .json(&payload)
            .send()
    };
    let mut response = send(auth.access_token(false).await?).await?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        response = send(auth.access_token(true).await?).await?;
    }
    json_body(response).await
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
    Ok(json_body::<Profile>(response).await?.email_address)
}
