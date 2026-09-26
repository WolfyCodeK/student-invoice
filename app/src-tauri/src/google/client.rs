//! Which Google OAuth client the app signs in with, and the oauth2 client
//! built from it.
//!
//! Release builds embed the owner's "Desktop app" client at compile time
//! (build.rs reads it from the secrets folder or the release environment; it
//! is never in the repository). Google treats installed-app secrets as
//! non-confidential: sign-in is protected by PKCE and the user's consent.
//! A user-supplied client in Credential Manager overrides it
//! (docs/decisions/0003-bundled-google-oauth-client.md).
use oauth2::basic::BasicClient;
use oauth2::{
    AuthType, AuthUrl, ClientId, ClientSecret, EndpointNotSet, EndpointSet, RevocationUrl, TokenUrl,
};

use super::store::{self, ClientCredentials};
use crate::error::AppResult;

pub const COMPOSE_SCOPE: &str = "https://www.googleapis.com/auth/gmail.compose";

/// oauth2 client with auth, revocation and token endpoints set.
pub type GoogleClient =
    BasicClient<EndpointSet, EndpointNotSet, EndpointNotSet, EndpointSet, EndpointSet>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ClientSource {
    BuiltIn,
    Custom,
}

pub fn built_in() -> Option<ClientCredentials> {
    match (
        option_env!("SI_GOOGLE_CLIENT_ID"),
        option_env!("SI_GOOGLE_CLIENT_SECRET"),
    ) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => {
            Some(ClientCredentials {
                client_id: id.to_string(),
                client_secret: secret.to_string(),
            })
        }
        _ => None,
    }
}

/// The client to use: the user's override if set, otherwise the built-in one.
pub fn active() -> AppResult<Option<(ClientCredentials, ClientSource)>> {
    if let Some(custom) = store::load_client_override()? {
        return Ok(Some((custom, ClientSource::Custom)));
    }
    Ok(built_in().map(|c| (c, ClientSource::BuiltIn)))
}

pub fn oauth_client(creds: &ClientCredentials) -> GoogleClient {
    BasicClient::new(ClientId::new(creds.client_id.clone()))
        .set_client_secret(ClientSecret::new(creds.client_secret.clone()))
        .set_auth_uri(
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".into()).expect("valid URL"),
        )
        .set_token_uri(
            TokenUrl::new("https://oauth2.googleapis.com/token".into()).expect("valid URL"),
        )
        .set_revocation_url(
            RevocationUrl::new("https://oauth2.googleapis.com/revoke".into()).expect("valid URL"),
        )
        .set_auth_type(AuthType::RequestBody)
}
