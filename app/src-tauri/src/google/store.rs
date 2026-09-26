//! Persistent Google data, kept in Windows Credential Manager (never in the
//! webview's localStorage):
//! - the signed-in account: refresh token, email, and which client issued it;
//! - an optional user-supplied OAuth client that overrides the built-in one.
use std::collections::HashMap;

use keyring_core::Entry;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

const SERVICE: &str = "com.isaac.student-invoice";
const ACCOUNT_USER: &str = "google-account";
const CLIENT_OVERRIDE_USER: &str = "google-oauth-client";

/// Registers the platform credential store. Call once at start-up.
pub fn init() -> AppResult<()> {
    #[cfg(windows)]
    keyring_core::set_default_store(windows_native_keyring_store::Store::new()?);
    Ok(())
}

fn entry(user: &str) -> AppResult<Entry> {
    // "Local": stays on this PC rather than roaming with a domain profile.
    let modifiers = HashMap::from([("persistence", "Local")]);
    Ok(Entry::new_with_modifiers(SERVICE, user, &modifiers)?)
}

fn load<T: for<'de> Deserialize<'de>>(user: &str) -> AppResult<Option<T>> {
    match entry(user)?.get_password() {
        Ok(json) => Ok(serde_json::from_str(&json).ok()),
        Err(keyring_core::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

fn save<T: Serialize>(user: &str, value: &T) -> AppResult<()> {
    let json = serde_json::to_string(value).map_err(|e| AppError::Internal(e.to_string()))?;
    entry(user)?.set_password(&json)?;
    Ok(())
}

fn delete(user: &str) -> AppResult<()> {
    match entry(user)?.delete_credential() {
        Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    pub refresh_token: String,
    pub email: Option<String>,
    /// The OAuth client that issued the token; a token only works with it.
    pub client_id: String,
}

impl std::fmt::Debug for StoredAccount {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StoredAccount")
            .field("email", &self.email)
            .field("client_id", &self.client_id)
            .finish_non_exhaustive()
    }
}

pub fn load_account() -> AppResult<Option<StoredAccount>> {
    load(ACCOUNT_USER)
}

pub fn save_account(account: &StoredAccount) -> AppResult<()> {
    save(ACCOUNT_USER, account)
}

pub fn delete_account() -> AppResult<()> {
    delete(ACCOUNT_USER)
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClientCredentials {
    pub client_id: String,
    pub client_secret: String,
}

impl std::fmt::Debug for ClientCredentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClientCredentials")
            .field("client_id", &self.client_id)
            .finish_non_exhaustive()
    }
}

pub fn load_client_override() -> AppResult<Option<ClientCredentials>> {
    load(CLIENT_OVERRIDE_USER)
}

pub fn save_client_override(creds: &ClientCredentials) -> AppResult<()> {
    save(CLIENT_OVERRIDE_USER, creds)
}

pub fn delete_client_override() -> AppResult<()> {
    delete(CLIENT_OVERRIDE_USER)
}
