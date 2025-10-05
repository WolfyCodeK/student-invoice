use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use oauth2::{
    AuthorizationCode,
    AuthUrl,
    ClientId,
    ClientSecret,
    CsrfToken,
    PkceCodeChallenge,
    RedirectUrl,
    Scope,
    TokenResponse,
    TokenUrl,
};
use reqwest::Client;
use base64::{Engine as _, engine::general_purpose};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailDraft {
    pub id: String,
    pub message: GmailMessage,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailMessage {
    pub id: String,
    pub thread_id: String,
}

#[derive(Debug)]
pub struct GmailClient {
    client: Client,
    config: GmailConfig,
}

impl GmailClient {
    pub fn new(config: GmailConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    pub async fn get_auth_url(&self) -> Result<(String, String), anyhow::Error> {
        let client = oauth2::basic::BasicClient::new(
            ClientId::new(self.config.client_id.clone()),
            Some(ClientSecret::new(self.config.client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())?,
            Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string())?),
        )
        .set_redirect_uri(RedirectUrl::new(self.config.redirect_uri.clone())?);

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (auth_url, _csrf_token) = client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.compose".to_string()))
            .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.send".to_string()))
            .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.modify".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();

        Ok((auth_url.to_string(), pkce_verifier.secret().clone()))
    }

    pub async fn exchange_code_for_token(
        &self,
        code: String,
        pkce_verifier: String,
    ) -> Result<TokenData, anyhow::Error> {
        let client = oauth2::basic::BasicClient::new(
            ClientId::new(self.config.client_id.clone()),
            Some(ClientSecret::new(self.config.client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())?,
            Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string())?),
        )
        .set_redirect_uri(RedirectUrl::new(self.config.redirect_uri.clone())?);

        let token_result = client
            .exchange_code(AuthorizationCode::new(code))
            .set_pkce_verifier(oauth2::PkceCodeVerifier::new(pkce_verifier))
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        let expires_in_seconds = token_result.expires_in().unwrap_or(std::time::Duration::from_secs(3600)).as_secs() as i64;

        let token_data = TokenData {
            access_token: token_result.access_token().secret().clone(),
            refresh_token: token_result.refresh_token().map(|t| t.secret().clone()),
            expires_at: Utc::now() + chrono::Duration::seconds(expires_in_seconds),
        };

        Ok(token_data)
    }

    pub async fn create_draft(
        &self,
        token: &TokenData,
        subject: String,
        body: String,
    ) -> Result<GmailDraft, anyhow::Error> {
        // Get a valid token (refresh if needed)
        let current_token = self.get_valid_token(token).await?;

        // Create the email message
        let email_content = self.create_email_message(&subject, &body);
        let encoded_message = general_purpose::STANDARD.encode(email_content);

        let mut draft_data = HashMap::new();
        let mut message = HashMap::new();
        message.insert("raw", encoded_message);

        draft_data.insert("message", message);

        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/drafts")
            .bearer_auth(&current_token.access_token)
            .json(&draft_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Gmail API error: {}", error_text));
        }

        let draft: GmailDraft = response.json().await?;
        Ok(draft)
    }

    async fn refresh_access_token(&self, refresh_token: &str) -> Result<TokenData, anyhow::Error> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
        ];

        let response = self.client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to refresh token"));
        }

        let token_response: serde_json::Value = response.json().await?;
        let access_token = token_response["access_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("No access token in refresh response"))?
            .to_string();

        let expires_in = token_response["expires_in"]
            .as_u64()
            .unwrap_or(3600);

        Ok(TokenData {
            access_token,
            refresh_token: Some(refresh_token.to_string()),
            expires_at: Utc::now() + chrono::Duration::seconds(expires_in as i64),
        })
    }

    async fn get_valid_token(&self, token: &TokenData) -> Result<TokenData, anyhow::Error> {
        if Utc::now() > token.expires_at {
            if let Some(refresh_token) = &token.refresh_token {
                self.refresh_access_token(refresh_token).await
            } else {
                Err(anyhow::anyhow!("Token expired and no refresh token available"))
            }
        } else {
            Ok(token.clone())
        }
    }

    fn create_email_message(&self, subject: &str, body: &str) -> String {
        format!(
            "Subject: {}\r\nTo: \r\n\r\n{}",
            subject, body
        )
    }
}

pub fn create_gmail_client(client_id: String, client_secret: String) -> GmailClient {
    let config = GmailConfig {
        client_id,
        client_secret,
        redirect_uri: "http://localhost:3001/auth/callback".to_string(),
    };

    GmailClient::new(config)
}
