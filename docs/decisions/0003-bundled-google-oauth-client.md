# 0003: The Google OAuth Desktop client is compiled into release builds

**Date:** 2026-09-26. **Status:** accepted; implemented in v1.1.0 (see [Gmail](../gmail.md)).

## Context

- In v1.0.1, each user pasted the owner's Google OAuth client ID and secret
  into Settings. The secret was stored in plaintext in localStorage and had
  also leaked through the public repository.
- Google treats installed-app client secrets as non-confidential. Sign-in is
  protected by PKCE and by the user's own consent.
- The secret identifies the app. It gives no access to the owner's Google
  account or anyone's mailbox.

## Decision

- Release builds embed the Desktop client ID and secret at compile time. The
  release script reads them from the owner's secrets folder into the build's
  environment (`SI_GOOGLE_CLIENT_ID` / `SI_GOOGLE_CLIENT_SECRET`).
- They are never committed.
- Settings keeps an optional "advanced" override, stored in Windows Credential
  Manager rather than localStorage.

## Consequences

- Users just click "Connect Gmail".
- Anyone can extract the secret from the exe. The only possible abuse is
  impersonating the app on a consent screen or using up API quota. That is
  limited by requesting only the `gmail.compose` scope, and it can be fixed by
  rotating the secret.
- Rotating the secret needs a new release. v1.0.1 users paste the new values
  into Settings.
