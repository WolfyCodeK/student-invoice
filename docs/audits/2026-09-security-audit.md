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

## Findings

| Id | Sev | Finding | Status |
|---|---|---|---|
| S1 | Critical | Google OAuth client ID + secret committed in `student-invoice-tauri/.env` in the root commit of a public repo. | **Fixed:** new Desktop OAuth client created; history rewritten with git-filter-repo (2026-09-26); GitHub secret scanning + push protection enabled. Old Web client to be deleted once users have switched. |
| S2 | High | Updater signing-key password (`tauri`) hard-coded in `Release.ps1` and old docs; a build script printed the private key. The key file itself was never committed. | Scripts/docs removed; password moves out of the repo with the new release tooling; key to be re-encrypted with a strong password (same key, so installs keep trusting it). |
| S3 | High | Google client secret stored in plaintext in WebView localStorage (`settings.gmailClientSecret`) and passed over IPC on each connect. | Open — v1.1.0 compiles the client into release builds; optional override goes to Windows Credential Manager. |
| S4 | High | No Content Security Policy (`csp: null`). | Open |
| S5 | High | No app ACL manifest: every custom command (incl. dead ones: `greet`, `get_gmail_auth_url`, `exchange_gmail_code`, `is_gmail_authenticated`) is callable from any script in the webview. | Open |
| S6 | Medium | OAuth `state` generated but never checked; loopback server has no read limit/timeout, handles connections serially, never closes on failure, and logs the auth code prefix. | Open |
| S7 | Medium | Requested scopes `gmail.modify` and `gmail.send` are unnecessary (only drafts are created, which needs `gmail.compose`). `gmail.modify` grants full mailbox read/write. | Open |
| S8 | Medium | MIME header injection: CR/LF in the subject reach the raw message (see B13). | Open |
| S9 | Low | `dotenvy` loaded a `.env` from the working directory at runtime (could set proxy or WebView2 data-folder variables). | **Fixed** (removed). |
| S10 | Low | EmailJS feedback: sends `to_email` from the client (if the EmailJS template uses it, anyone could relay mail), logs keys and message to the console, no length limit. EmailJS public key is public by design. | Open; dashboard check pending. |
| S11 | Low | HTTP client has no timeouts. | Open |
| S12 | Info | MSI is not Authenticode-signed, so Windows SmartScreen warns on first install. Updates are signed with minisign regardless. | Optional (paid certificate / Azure Trusted Signing). |
| S13 | Info | No dependency auditing; lockfiles ~1 year old (oauth2 4.x pulls a second, older HTTP stack). | Open — CI audit + upgrades. |
