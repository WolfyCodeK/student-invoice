# Gmail integration

The app can save each invoice as a **draft** in the user's Gmail account. It
never sends email itself. The user reviews the draft in Gmail and sends it.

## Google Cloud setup

- **Project:** the owner's Google Cloud project (number `267860014369`),
  publishing status *In production*, unverified (users see a "Google hasn't
  verified this app" screen, and there is a limit of 100 users).
- **OAuth client:** type **Desktop app**, named `student-invoice-desktop-app`.
  Its credentials are kept outside the repo in
  `%USERPROFILE%\.secrets\student-invoice\google-oauth-client.json`, in
  Google's download format, and in the owner's password manager. They are
  never committed (see [security](security.md)).
- The old *Web application* client, whose secret leaked, is being retired
  once all users have switched.

## How credentials reach the app (current behaviour)

The user pastes the client ID and secret into **Settings**. They are saved in
localStorage (`settings.gmailClientId` / `gmailClientSecret`, in plaintext)
and passed to Rust on every "Connect Gmail".

## Sign-in flow

1. The UI calls `start_oauth_server(clientId, clientSecret)`.
2. Rust binds `127.0.0.1:3001` and builds a Google authorization URL with
   PKCE (S256). It requests the scopes `gmail.compose`, `gmail.send` and
   `gmail.modify`. The redirect URI is `http://localhost:3001/auth/callback`.
3. The UI opens that URL in the default browser. The user signs in and
   consents.
4. Google redirects to the loopback server. Rust reads the `code` from the
   request line, exchanges it for tokens (sending the client secret), stores
   the tokens in memory, emits the `oauth_success` event, and returns a small
   HTML page.
5. The UI hears `oauth_success`, refreshes its status and shows "connected".

## Creating a draft

The `create_gmail_draft(subject, body)` command builds a raw message
`Subject: …\r\nTo: \r\n\r\n<body>`, base64-encodes it, and POSTs it to
`gmail/v1/users/me/drafts`. If the access token has expired and a refresh
token exists, it refreshes first, but the refreshed token is not saved.
"Draft All" does this for every template in turn.

## Known issues

These are tracked in the [bug audit](audits/2026-09-bug-audit.md) (B8, B10,
B11, B13, B17, B21, B22) and the [security audit](audits/2026-09-security-audit.md)
(S3, S6, S7, S8, S11): unchecked `state`, unnecessary scopes, plaintext
secret, the port never being released, no charset/encoding, header
injection, tokens lost on restart, and "Disconnect" not disconnecting.
