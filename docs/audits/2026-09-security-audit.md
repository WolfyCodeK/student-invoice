# Security audit — September 2026 (v1.0.1 → v1.1.0)

Status: **in progress.** Working record of the security audit preceding
v1.1.0. Locations refer to v1.0.1 code unless stated.

## Threat model (summary)

- **Assets:** users' student/parent names, fees and email templates (local
  data); users' Gmail accounts (via OAuth tokens); the app's Google OAuth
  client; the updater signing key (whoever holds it can push code to every
  install).
- **Attackers considered:** anyone reading the public repository; a malicious
  or compromised web page/script reaching the webview; other local processes
  on the user's PC (e.g. hitting the OAuth loopback port); a tampered import
  file; a network attacker (mitigated by HTTPS and update signatures).
- **Out of scope:** a fully compromised Windows account.

## Runtime verification (2026-09-26)

- **Command allowlist (S5):** in the running app, the removed command `greet`
  and the plugin commands `opener.open_url`, `dialog.open` and `updater.check`
  are all rejected as "not allowed".
- **Content Security Policy (S4):** tested in a debug build serving the
  bundled assets, with a separate test identifier, through the Chrome
  DevTools Protocol:
  - no violations or errors on load;
  - an injected inline `<script>`, a `fetch` to an unknown host and an
    external image are all blocked with CSP violations;
  - `api.emailjs.com` is allowed;
  - `Object.prototype` is frozen;
  - the origin is still `http://tauri.localhost`.
- **The CSP also blocks the Tauri MCP bridge's injected helpers.** So the
  bridge only works in `pnpm dev:mcp`, where there is no CSP, which is
  another reason it can't be abused in a shipped build.

## Findings

| Id | Sev | Finding | Status |
|---|---|---|---|
| S1 | Critical | Google OAuth client ID + secret committed in `student-invoice-tauri/.env` in the root commit of a public repo. | **Fixed:** new Desktop OAuth client created; history rewritten with git-filter-repo (2026-09-26); GitHub secret scanning + push protection enabled. Old Web client to be deleted once users have switched. |
| S2 | High | Updater signing-key password (`tauri`) hard-coded in `Release.ps1` and old docs; a build script printed the private key. The key file itself was never committed. | **Fixed:** scripts and docs removed. The release scripts ask for the password at a hidden prompt and never store it. On 2026-09-26 the owner re-encrypted the key with a strong password using `scripts/release/change-key-password.mjs` (same key, so installs keep trusting it). |
| S3 | High | Google client secret stored in plaintext in WebView localStorage (`settings.gmailClientSecret`) and passed over IPC on each connect. | Fixed (v1.1.0): built-in client compiled in; optional override and refresh token in Windows Credential Manager; legacy plaintext cleared on load |
| S4 | High | No Content Security Policy (`csp: null`). | Fixed (v1.1.0): strict CSP + freezePrototype; runtime check pending |
| S5 | High | No app ACL manifest: every custom command (incl. dead ones: `greet`, `get_gmail_auth_url`, `exchange_gmail_code`, `is_gmail_authenticated`) is callable from any script in the webview. | Fixed (v1.1.0): app ACL manifest + per-command allow-list; dead commands removed; webview core/opener permissions reduced |
| S6 | High | OAuth `state` generated but never checked; loopback server has no read limit/timeout, handles connections serially, never closes on failure (so it stays listening after an abandoned sign-in), and logs the full request line including code and state. **Login-CSRF scenario:** while the listener is up, any web page can navigate the browser to `http://localhost:3001/auth/callback?code=<code for the attacker's account>`; the app would then connect to the attacker's Gmail and save every invoice (student and parent names, fees) there as drafts. PKCE may or may not stop this (unconfirmed whether Google rejects a verifier for a code issued without a challenge), so the `state` check is the real control. | Fixed (v1.1.0): state verified, one-shot listener with timeouts/size cap/concurrent handling, no logging; parser unit-tested |
| S7 | Medium | Requested scopes `gmail.modify` and `gmail.send` are unnecessary (only drafts are created, which needs `gmail.compose`). `gmail.modify` grants full mailbox read/write. | Fixed (v1.1.0): only gmail.compose requested; granted scope verified |
| S8 | Medium | MIME header injection: CR/LF in the subject reach the raw message (see B13). | Fixed (v1.1.0): header values sanitised, RFC 2047 subject (unit-tested) |
| S9 | Low | `dotenvy` loaded a `.env` from the working directory at runtime (could set proxy or WebView2 data-folder variables). | **Fixed** (removed). |
| S10 | Low | EmailJS feedback: sends `to_email` from the client (if the EmailJS template uses it, anyone could relay mail), logs keys and message to the console, no length limit. EmailJS public key is public by design. | **Fixed:** no console logging and a 5,000-character limit. The owner confirmed on 2026-09-26 that the template's To Email is fixed to their address, so `to_email` was never usable for relaying. v1.1.0 no longer sends it. |
| S11 | Low | HTTP client has no timeouts. | Fixed (v1.1.0): 10 s connect / 30 s total timeouts; updater 60 s |
| S12 | Info | MSI is not Authenticode-signed, so Windows SmartScreen warns on first install. Updates are signed with minisign regardless. | Optional (paid certificate / Azure Trusted Signing). |
| S13 | Info | No dependency auditing; lockfiles ~1 year old (oauth2 4.x pulls a second, older HTTP stack). | CI now runs `pnpm audit` and `cargo audit`. Tauri upgraded to 2.11. npm audit (2026-09-26): no known vulnerabilities. |
| S15 | Medium | Redirect URI `http://localhost:3001/…` with a fixed port, while the listener binds only `127.0.0.1`. Browsers may try `::1` first; on Windows another same-user program can hold `[::]:3001` (or bind it after us) and receive the authorization code. RFC 8252 §8.3 recommends against `localhost`. Fix: bind `127.0.0.1:0` (ephemeral port) and redirect to `http://127.0.0.1:<port>/`, which Google allows for Desktop clients. | Fixed (v1.1.0): 127.0.0.1 with an ephemeral port |
| S16 | Medium (dev only) | The Tauri MCP bridge's WebSocket (port 9223+) accepts any origin with no token. While `pnpm dev:mcp` runs, a web page in the developer's browser could connect to `ws://127.0.0.1:9223` and run JavaScript in the dev app or call its commands. Binding to 127.0.0.1 doesn't stop browser-originated connections. Never shipped (invariant `mcp-bridge-dev-only`). | Mitigation documented in docs/development.md: run `dev:mcp` only with test data and no real Gmail account connected. Report upstream. |
| S17 | Low | `requireSignedVersion` is off in the updater config, so someone able to edit a GitHub release could pair a higher `version` in latest.json with an older, validly signed MSI (downgrade attack). v1.0.0/v1.0.1 signatures carry no version. | Open — enable from v1.1.0 once its `.sig` is confirmed to include the version (protects updates from 1.1.0 onwards). |
| S18 | Low | Byte-slicing the authorization code for a log line panics on a multi-byte character; any local process or web page hitting the callback URL can kill a pending sign-in (B52). With `panic = "abort"` it would crash the app. | Fixed (v1.1.0): code no longer sliced or logged |
| S19 | Info | Structs holding the client secret and tokens derive `Debug`, so any future `{:?}` log would leak them; a huge `expires_in` would overflow and panic (only from a compromised token endpoint). | Fixed (v1.1.0): redacting Debug; token lifetimes clamped |
| S14 | Medium | `cargo audit` (2026-09-26): 4 advisories, all in the old HTTP stack pulled in only by `oauth2` 4.x → reqwest 0.11: `h2` 0.3.27 (RUSTSEC-2026-0258, unbounded empty DATA frames) and `rustls-webpki` 0.101.7 (RUSTSEC-2026-0098/0099 name-constraint checks, RUSTSEC-2026-0104 CRL parsing panic). They affect TLS to Google's token endpoint. 8 further "unmaintained/unsound" warnings come from Tauri's own tree (unic-*, proc-macro-error, glib — Linux-only) and are not exploitable here. | Fixed (v1.1.0): oauth2 5 on the app's reqwest 0.12; `cargo audit` reports 0 vulnerabilities (7 unmaintained-crate warnings from Tauri's own tree) |

## Final review before release (2026-09-27)

A security review of every change since v1.0.1 (`v1.0.1..HEAD`) found no
exploitable issues. One finding was recorded and fixed, and some hardening
was applied.

| Id | Sev | Finding | Status |
|---|---|---|---|
| S20 | Low | `build.rs` passed the built-in Google client ID and secret to the compiler with `cargo:rustc-env`. Cargo shows a build script's output when the build fails (and always with `-vv`), so the secret could end up on screen, in a log or in an AI assistant's context. Every build embeds it anyway ([decision 0003](../decisions/0003-bundled-google-oauth-client.md)), but secrets must never appear in logs or chat. | Fixed (v1.1.0): `build.rs` writes it to a generated `google_client.rs` in Cargo's build folder and never prints it; a malformed secrets file gives a generic warning that doesn't quote it |

**Hardening:**
- The sign-in callback page HTML-escapes its title and message
  (`loopback.rs`). Its text is fixed, so this is defence in depth.
- The release script no longer lets `JSON.parse`'s error message through
  for a malformed Google client file, since the message quotes part of the
  file.
- The Credential Manager entry is named after the app's identifier. The
  perf-test build (a release build with its own identifier) used to share
  the installed app's entry, so signing in or disconnecting there could
  replace or revoke the installed app's Gmail sign-in. The installed app
  keeps the name every version has used (unit-tested).
- The plaintext Google credentials from v1.0.1 (S3) are now cleared on every
  start, not only once ([bug audit](2026-09-bug-audit.md) B66).

**Still open, as before:** S16 (the development-only MCP bridge) and S17
(`requireSignedVersion`).
