//! Google sign-in (OAuth 2.0 for installed apps) and access-token handling.
//!
//! Flow: bind a one-shot HTTP listener on 127.0.0.1 with an ephemeral port →
//! open the system browser at Google's consent page (PKCE S256, random
//! `state`, only the `gmail.compose` scope) → wait for the redirect (with a
//! timeout and a cancel handle) → exchange the code → keep the refresh token
//! in Windows Credential Manager and the access token only in memory.
use std::net::Ipv4Addr;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};

use oauth2::basic::BasicErrorResponseType;
use oauth2::{
    AuthorizationCode, CsrfToken, PkceCodeChallenge, RedirectUrl, RefreshToken, RequestTokenError,
    Scope, StandardRevocableToken, TokenResponse,
};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::task::JoinSet;

use super::client::{self, ClientSource, COMPOSE_SCOPE};
use super::loopback::{self, Callback};
use super::store::{self, ClientCredentials, StoredAccount};
use crate::error::{AppError, AppResult};

const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
/// Refresh the access token when less than this is left.
const EXPIRY_MARGIN: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmailStatus {
    /// A refresh token is stored for the active OAuth client.
    pub connected: bool,
    pub email: Option<String>,
    /// An OAuth client is available (built in or custom).
    pub configured: bool,
    pub client_source: Option<ClientSource>,
    /// A sign-in is currently waiting for the browser.
    pub connecting: bool,
}

struct AccessToken {
    secret: String,
    expires: Instant,
}

impl AccessToken {
    /// The access token from a token response. Its lifetime is clamped to
    /// between 1 minute and 24 hours (1 hour if Google doesn't say).
    fn from_response(token: &impl TokenResponse) -> Self {
        let lifetime = token
            .expires_in()
            .unwrap_or(Duration::from_secs(3600))
            .clamp(Duration::from_secs(60), Duration::from_secs(86_400));
        Self {
            secret: token.access_token().secret().clone(),
            expires: Instant::now() + lifetime,
        }
    }
}

pub struct GoogleAuth {
    http: reqwest::Client,
    /// Cancels the sign-in currently waiting for the browser, if any.
    pending: StdMutex<Option<oneshot::Sender<()>>>,
    /// Held across refreshes so concurrent drafts refresh only once.
    access: Mutex<Option<AccessToken>>,
}

impl GoogleAuth {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            http,
            pending: StdMutex::new(None),
            access: Mutex::new(None),
        }
    }

    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }

    fn is_connecting(&self) -> bool {
        self.pending.lock().map(|p| p.is_some()).unwrap_or(false)
    }

    pub fn status(&self) -> AppResult<GmailStatus> {
        let active = client::active()?;
        let account = store::load_account()?;
        let connected = match (&active, &account) {
            (Some((creds, _)), Some(acc)) => acc.client_id == creds.client_id,
            _ => false,
        };
        Ok(GmailStatus {
            connected,
            email: if connected {
                account.and_then(|a| a.email)
            } else {
                None
            },
            configured: active.is_some(),
            client_source: active.map(|(_, s)| s),
            connecting: self.is_connecting(),
        })
    }

    /// Cancels a sign-in that is waiting for the browser. Harmless if none.
    pub fn cancel_connect(&self) {
        if let Some(tx) = self.pending.lock().ok().and_then(|mut p| p.take()) {
            let _ = tx.send(());
        }
    }

    /// Runs the whole sign-in and resolves when it succeeds, fails, times out
    /// or is cancelled. Starting a new sign-in cancels any previous one.
    pub async fn connect(&self, app: &AppHandle) -> AppResult<GmailStatus> {
        let (creds, _) = client::active()?.ok_or(AppError::NotConfigured)?;
        self.cancel_connect();
        let (cancel_tx, cancel_rx) = oneshot::channel();
        *self
            .pending
            .lock()
            .map_err(|_| AppError::Internal("state lock poisoned".into()))? = Some(cancel_tx);

        let result = self.run_sign_in(app, &creds, cancel_rx).await;
        if let Ok(mut p) = self.pending.lock() {
            // Only clear our own handle; a newer sign-in may have replaced it.
            if p.as_ref().is_some_and(|tx| tx.is_closed()) {
                *p = None;
            }
        }
        result?;
        self.status()
    }

    async fn run_sign_in(
        &self,
        app: &AppHandle,
        creds: &ClientCredentials,
        cancel: oneshot::Receiver<()>,
    ) -> AppResult<()> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .map_err(|e| AppError::Internal(format!("couldn't start the sign-in listener: {e}")))?;
        let port = listener
            .local_addr()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .port();
        let redirect = RedirectUrl::new(format!("http://127.0.0.1:{port}/"))
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let oauth = client::oauth_client(creds).set_redirect_uri(redirect);

        let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
        let (url, csrf) = oauth
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new(COMPOSE_SCOPE.into()))
            .add_extra_param("prompt", "select_account")
            .set_pkce_challenge(challenge)
            .url();
        app.opener()
            .open_url(url.as_str(), None::<&str>)
            .map_err(|e| AppError::Internal(format!("couldn't open the browser: {e}")))?;

        let code = tokio::select! {
            r = tokio::time::timeout(SIGN_IN_TIMEOUT, wait_for_callback(listener, csrf.secret().clone())) => {
                r.map_err(|_| AppError::Timeout)??
            }
            _ = cancel => return Err(AppError::Cancelled),
        };

        let token = oauth
            .exchange_code(AuthorizationCode::new(code))
            .set_pkce_verifier(verifier)
            .request_async(&self.http)
            .await
            .map_err(token_error)?;
        if let Some(scopes) = token.scopes() {
            if !scopes.iter().any(|s| s.as_str() == COMPOSE_SCOPE) {
                if let Some(rt) = token.refresh_token() {
                    let _ = self.revoke(creds, rt.secret()).await;
                }
                return Err(AppError::ScopeNotGranted);
            }
        }
        let refresh = token
            .refresh_token()
            .ok_or_else(|| {
                AppError::Google("Google didn't return a refresh token. Please try again.".into())
            })?
            .secret()
            .clone();
        let email = super::gmail::profile_email(&self.http, token.access_token().secret())
            .await
            .ok();

        // Replace any previous account; revoke its token best-effort.
        if let Some(old) = store::load_account()?.filter(|old| old.refresh_token != refresh) {
            self.revoke_account(&old).await?;
        }
        store::save_account(&StoredAccount {
            refresh_token: refresh,
            email,
            client_id: creds.client_id.clone(),
        })?;
        *self.access.lock().await = Some(AccessToken::from_response(&token));
        Ok(())
    }

    /// A valid access token, refreshing it if needed. `force` discards the
    /// cached token first (used after Gmail rejects it with 401).
    pub async fn access_token(&self, force: bool) -> AppResult<String> {
        let mut cached = self.access.lock().await;
        if force {
            *cached = None;
        }
        if let Some(t) = cached.as_ref() {
            if t.expires > Instant::now() + EXPIRY_MARGIN {
                return Ok(t.secret.clone());
            }
        }
        let (creds, _) = client::active()?.ok_or(AppError::NotConfigured)?;
        let account = store::load_account()?.ok_or(AppError::NotConnected)?;
        if account.client_id != creds.client_id {
            // The stored token belongs to a different OAuth client.
            return Err(AppError::ReauthRequired);
        }
        let oauth = client::oauth_client(&creds);
        let token = match oauth
            .exchange_refresh_token(&RefreshToken::new(account.refresh_token.clone()))
            .request_async(&self.http)
            .await
        {
            Ok(t) => t,
            Err(RequestTokenError::ServerResponse(e))
                if *e.error() == BasicErrorResponseType::InvalidGrant =>
            {
                // Revoked, expired, password changed, or over Google's token limit.
                store::delete_account()?;
                *cached = None;
                return Err(AppError::ReauthRequired);
            }
            Err(e) => return Err(token_error(e)),
        };
        if let Some(new_refresh) = token.refresh_token() {
            if new_refresh.secret() != &account.refresh_token {
                store::save_account(&StoredAccount {
                    refresh_token: new_refresh.secret().clone(),
                    ..account
                })?;
            }
        }
        let access = AccessToken::from_response(&token);
        let secret = access.secret.clone();
        *cached = Some(access);
        Ok(secret)
    }

    /// Signs out (see `forget_account`) and returns the new status.
    pub async fn disconnect(&self) -> AppResult<GmailStatus> {
        self.forget_account().await?;
        self.status()
    }

    /// Cancels any pending sign-in, forgets the account on this PC and
    /// revokes its access at Google (best effort: the local copy is removed
    /// even if Google can't be reached).
    async fn forget_account(&self) -> AppResult<()> {
        self.cancel_connect();
        if let Some(account) = store::load_account()? {
            self.revoke_account(&account).await?;
        }
        store::delete_account()?;
        *self.access.lock().await = None;
        Ok(())
    }

    /// Revokes a stored account's refresh token, best effort. Only the client
    /// that issued a token can revoke it, so nothing is sent if that client
    /// is no longer the active one.
    async fn revoke_account(&self, account: &StoredAccount) -> AppResult<()> {
        if let Some((creds, _)) =
            client::active()?.filter(|(c, _)| c.client_id == account.client_id)
        {
            let _ = self.revoke(&creds, &account.refresh_token).await;
        }
        Ok(())
    }

    async fn revoke(&self, creds: &ClientCredentials, refresh_token: &str) -> AppResult<()> {
        client::oauth_client(creds)
            .revoke_token(StandardRevocableToken::RefreshToken(RefreshToken::new(
                refresh_token.to_string(),
            )))
            .map_err(|e| AppError::Internal(e.to_string()))?
            .request_async(&self.http)
            .await
            .map_err(|_| AppError::Network("couldn't revoke access".into()))
    }

    /// Switches to a user-supplied OAuth client (or back to the built-in one
    /// with `None`). The stored account is dropped because its token belongs
    /// to the previous client.
    pub async fn set_client_override(
        &self,
        creds: Option<ClientCredentials>,
    ) -> AppResult<GmailStatus> {
        self.forget_account().await?;
        match creds {
            Some(c) => store::save_client_override(&c)?,
            None => store::delete_client_override()?,
        }
        self.status()
    }
}

fn token_error<RE: std::error::Error + 'static>(
    e: RequestTokenError<RE, oauth2::StandardErrorResponse<BasicErrorResponseType>>,
) -> AppError {
    match e {
        RequestTokenError::ServerResponse(r) => {
            let detail = r
                .error_description()
                .cloned()
                .unwrap_or_else(|| r.error().to_string());
            AppError::Google(detail)
        }
        RequestTokenError::Request(_) => {
            AppError::Network("couldn't reach Google's sign-in service".into())
        }
        RequestTokenError::Parse(_, _) | RequestTokenError::Other(_) => {
            AppError::Google("unexpected response from Google".into())
        }
    }
}

/// Accepts connections until one carries the redirect for this sign-in.
/// Each connection is handled in its own task with a read timeout and size
/// cap, so an idle browser pre-connect can't block the real callback.
async fn wait_for_callback(listener: TcpListener, state: String) -> AppResult<String> {
    let (tx, mut rx) = mpsc::channel::<Result<String, AppError>>(1);
    let mut tasks = JoinSet::new();
    loop {
        tokio::select! {
            accepted = listener.accept() => {
                let Ok((stream, _)) = accepted else { continue };
                let (tx, state) = (tx.clone(), state.clone());
                tasks.spawn(async move {
                    if let Some(outcome) = handle_connection(stream, &state).await {
                        let _ = tx.send(outcome).await;
                    }
                });
            }
            Some(outcome) = rx.recv() => {
                tasks.abort_all();
                return outcome;
            }
        }
    }
}

async fn handle_connection(mut stream: TcpStream, state: &str) -> Option<Result<String, AppError>> {
    let mut buf = Vec::with_capacity(1024);
    let read = tokio::time::timeout(READ_TIMEOUT, async {
        let mut chunk = [0u8; 1024];
        while !buf.windows(4).any(|w| w == b"\r\n\r\n") && buf.len() < loopback::MAX_REQUEST_BYTES {
            match stream.read(&mut chunk).await {
                Ok(0) | Err(_) => break,
                Ok(n) => buf.extend_from_slice(&chunk[..n]),
            }
        }
    })
    .await;
    if read.is_err() || buf.is_empty() {
        return None;
    }
    let head = String::from_utf8_lossy(&buf);
    let (response, outcome) = match loopback::request_target(&head).map(|t| loopback::classify(t, state)) {
        Some(Callback::Code(code)) => (
            loopback::response(200, "You're signed in", "Student Invoice is now connected to Gmail. You can close this tab and go back to the app."),
            Some(Ok(code)),
        ),
        Some(Callback::Denied(reason)) => (
            loopback::response(200, "Sign-in cancelled", "Gmail was not connected. You can close this tab and try again from the app."),
            Some(Err(if reason == "access_denied" { AppError::AccessDenied } else { AppError::Google(reason) })),
        ),
        Some(Callback::BadState) => (loopback::response(400, "Sign-in link not recognised", "Please start the sign-in again from the app."), None),
        Some(Callback::NotFound) | None => (loopback::response(404, "Not found", "Nothing here."), None),
    };
    let _ = stream.write_all(&response).await;
    let _ = stream.shutdown().await;
    outcome
}
