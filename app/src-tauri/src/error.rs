//! The single error type returned by every command. It reaches the UI as
//! `{ kind, message }`: `kind` lets the UI react (e.g. show "Reconnect
//! Gmail"), `message` is safe to show to the user. Messages never contain
//! tokens, codes or secrets.
use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Gmail isn't connected.")]
    NotConnected,
    #[error("Your Gmail connection has expired. Please reconnect Gmail.")]
    ReauthRequired,
    #[error("Gmail isn't set up in this copy of the app.")]
    NotConfigured,
    #[error("Sign-in was cancelled in the browser.")]
    AccessDenied,
    #[error("Sign-in timed out. Please try again.")]
    Timeout,
    #[error("Sign-in was cancelled.")]
    Cancelled,
    #[error(
        "Permission to create Gmail drafts wasn't granted. Please connect again and allow it."
    )]
    ScopeNotGranted,
    #[error("Couldn't reach Google: {0}")]
    Network(String),
    #[error("Google returned an error: {0}")]
    Google(String),
    #[error("Couldn't use Windows Credential Manager: {0}")]
    Storage(String),
    #[error("{0}")]
    Update(String),
    #[error("{0}")]
    Invalid(String),
    #[error("Something went wrong: {0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::NotConnected => "NotConnected",
            AppError::ReauthRequired => "ReauthRequired",
            AppError::NotConfigured => "NotConfigured",
            AppError::AccessDenied => "AccessDenied",
            AppError::Timeout => "Timeout",
            AppError::Cancelled => "Cancelled",
            AppError::ScopeNotGranted => "ScopeNotGranted",
            AppError::Network(_) => "Network",
            AppError::Google(_) => "Google",
            AppError::Storage(_) => "Storage",
            AppError::Update(_) => "Update",
            AppError::Invalid(_) => "Invalid",
            AppError::Internal(_) => "Internal",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("kind", self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        // reqwest errors can include the request URL; ours never carry secrets
        // in URLs, but keep the message short and generic anyway.
        let what = if e.is_timeout() {
            "the request timed out"
        } else if e.is_connect() {
            "couldn't connect"
        } else {
            "the connection failed"
        };
        AppError::Network(what.to_string())
    }
}

impl From<keyring_core::Error> for AppError {
    fn from(e: keyring_core::Error) -> Self {
        AppError::Storage(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_and_message() {
        let json = serde_json::to_value(AppError::ReauthRequired).unwrap();
        assert_eq!(json["kind"], "ReauthRequired");
        assert!(json["message"].as_str().unwrap().contains("reconnect"));
    }
}
