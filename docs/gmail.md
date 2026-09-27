# Gmail integration

The app saves each invoice as a **draft** in the user's Gmail account. It
never sends email itself: the user reviews each draft in Gmail and sends it
from there.

## Google Cloud setup

- **Project:** the owner's Google Cloud project (number `267860014369`).
  - Publishing status: *In production*, unverified.
  - Users therefore see a "Google hasn't verified this app" screen, and the
    app is limited to 100 users.
- **OAuth client:** a **Desktop app** client named
  `student-invoice-desktop-app`.
  - Its credentials live outside the repo, in
    `%USERPROFILE%\.secrets\student-invoice\google-oauth-client.json`
    (Google's download format), and in the owner's password manager.
- **Scope:** only `gmail.compose`, shown to users as "Manage drafts and send
  emails". That is all the app needs to create drafts.
- **Old client:** the old *Web application* client, whose secret leaked, is
  being retired once all v1.0.1 users have switched.

## Which OAuth client is used

The code for this is in `app/src-tauri/src/google/client.rs`.

- **Built in (normal case):** `app/src-tauri/build.rs` embeds the Desktop client
  at compile time. It writes the ID and secret into a generated
  `google_client.rs` in Cargo's build output folder, which `client.rs`
  includes; it never prints them, because Cargo shows a build script's output
  when a build fails.
  - It takes them from the `SI_GOOGLE_CLIENT_ID` / `SI_GOOGLE_CLIENT_SECRET`
    environment variables (the release script sets them), or otherwise from
    the secrets file above. A malformed file gives a generic warning that
    never quotes it.
  - Builds without either (e.g. CI) still work, but Gmail shows "not set up".
  - Why embedding the secret is acceptable:
    [decision 0003](decisions/0003-bundled-google-oauth-client.md).
- **Custom (advanced):** Settings → Gmail → *Advanced* lets a user enter their
  own client.
  - It is stored in Windows Credential Manager and overrides the built-in one.
  - Changing it disconnects Gmail, because tokens only work with the client
    that issued them.
- **Legacy credentials:** v1.0.1 stored a client ID and secret in plaintext
  in localStorage. v1.1.0 clears those fields on every start, not just once,
  so credentials typed again after going back to v1.0.1 are cleared too (see
  [data model](data-model.md#loading-and-upgrading-stored-data)).

## Sign-in flow

The code is in `app/src-tauri/src/google/auth.rs`, and the callback parsing
in `app/src-tauri/src/google/loopback.rs`.

1. The UI calls `gmail_connect`. It resolves when sign-in finishes, fails,
   times out (after 5 minutes) or is cancelled. Starting a new sign-in cancels
   any pending one. The *Cancel* button calls `gmail_cancel_connect`.
2. Rust starts listening on `127.0.0.1` on a random free port.
3. Rust builds Google's consent URL:
   - PKCE S256;
   - a random `state`;
   - the `gmail.compose` scope;
   - `prompt=select_account`;
   - redirect `http://127.0.0.1:<port>/`.
4. It opens that URL in the default browser itself, so the URL never passes
   through the webview.
5. **Each connection to the listener** is handled on its own:
   - It reads for at most 5 seconds and at most 8 KiB.
   - It accepts only `GET /?…` with the matching `state`.
   - It always replies with a small page (`Content-Length`,
     `Connection: close`, `no-store`). The page's text is fixed and
     HTML-escaped, so nothing from the request can appear on it as markup.
   - Anything else (favicon requests, wrong `state`, other paths) gets a 404
     or 400, and the listener keeps waiting.
   - Google's `error=access_denied` (the user pressed Cancel) ends the
     sign-in with a clear message.
6. **Code exchange.** The code is exchanged, with the PKCE verifier, for
   tokens:
   - The token response must include `gmail.compose`. Otherwise the new
     token is revoked, and the user is asked to allow it.
   - The signed-in address is read with `users.getProfile`, for display.
7. **Storage and cleanup:**
   - The **refresh token** goes to Windows Credential Manager, together with
     the email and the issuing client ID
     (`app/src-tauri/src/google/store.rs`). The entry is named after the
     app's identifier: `com.isaac.student-invoice` / `google-account` for the
     installed app, persistence *Local*. A build with another identifier (such
     as the performance-test build) gets its own entry, and development builds
     add `.dev` (`com.isaac.student-invoice.dev`), so a test sign-in never touches
     the installed app.
   - The **access token** is kept only in memory.
   - A previous account's refresh token is revoked.
   - The listener is dropped on every path, which frees the port.

Codes and tokens are never logged or sent to the webview.

## Using and refreshing tokens

- `access_token()` returns the cached access token while more than 60 seconds
  of its lifetime remain. Otherwise it refreshes.
- Refreshes are serialised, so "Draft all" refreshes once.
- A new refresh token returned by Google replaces the stored one.
- `invalid_grant` means the token was revoked, has expired (e.g. after 6
  months unused or a password change), or Google's per-account token limit
  was reached. It deletes the stored account and returns `ReauthRequired`,
  and the UI then offers *Connect Gmail* again.

## Creating a draft

The code is in `app/src-tauri/src/google/gmail.rs` and `app/src-tauri/src/google/mime.rs`.

- `gmail_create_draft(subject, body)` validates lengths, then builds an
  RFC 5322 message with no recipient (the teacher adds it in Gmail):
  - line breaks and control characters in headers are replaced (this stops
    header injection);
  - a non-ASCII subject is RFC 2047 encoded;
  - `text/plain; charset="UTF-8"` with a base64 body.
- The whole message is base64url-encoded and POSTed to
  `users/me/drafts`.
- On a 401 the access token is refreshed and the request retried once.
- Google's error message is passed to the UI, trimmed to 300 characters.
- **Draft all** (`createAllInvoiceDrafts` in `app/src/stores/app-store.ts`)
  creates drafts one at a time:
  - It takes the list of families when it starts, then reads each family's
    template, the wording settings and the term just before drafting it, so
    each draft matches what the app shows at that moment. A family deleted
    meanwhile is left out.
  - A family with nothing ticked is recorded as nothing to invoice, and one
    with an unusable lesson day as failed; neither stops the run.
  - It stops early after a connection error (`ReauthRequired`,
    `NotConnected`, `NotConfigured`, after which it refreshes the status) or
    a `Network` error, or if the wording has come to need Your name while
    none is set, and lists the rest as not tried, with what to fix.
  - Results are kept in the store (`draftResults`, never persisted) until
    the user closes them. With `remainingOnly` ("Draft the remaining"), the
    families already saved there are kept and only the rest are drafted, so
    none is drafted twice. A single draft (**Try again**) records its outcome
    there too while results are showing.
  - The UI lists every failure by family ([UI](ui.md#register)).

## Status and disconnect

- `gmail_status` returns:
  - `connected`: a stored token exists for the active client;
  - `email`;
  - `configured`: whether any client is available;
  - `clientSource`: built in or custom;
  - `connecting`.
- **The UI uses this live status**, asked for as the store loads. Until it
  arrives, the register says "Checking Gmail…". If the first call fails,
  the UI falls back to "not connected" and offers Connect Gmail. The persisted
  `gmailConnected` flag is only kept in step for v1.0.1 and is never shown.
- **A sign-in left pending by a reload:** reloading the window (F5) during
  sign-in doesn't stop the sign-in in Rust. If `gmail_status` then reports
  `connecting`, the store shows the connecting dialog (with Cancel) and asks
  `gmail_status` again once a second until the sign-in ends, which is at most
  the 5-minute sign-in timeout (`followPendingSignIn`).
- `gmail_disconnect` cancels any pending sign-in, revokes the refresh token at
  Google (best effort), and deletes it from Credential Manager.

## HTTP

All Google and Gmail requests use one `reqwest` client:
- native TLS, which trusts the Windows certificate store, so antivirus or
  proxy HTTPS inspection doesn't break sign-in;
- 10 s connect timeout and 30 s overall timeout;
- no redirects.

## Errors

Every command rejects with `{ kind, message }` (`app/src-tauri/src/error.rs`).
The `message` is written for users and never contains secrets. The UI
wrappers are in `app/src/lib/backend.ts`.
