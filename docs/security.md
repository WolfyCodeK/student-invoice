# Security

This page covers how secrets are handled and the app's security boundaries.
Open issues and their fixes are tracked in the
[security audit](audits/2026-09-security-audit.md).

## Secrets never live in the repository

| Secret | Where it lives | Used by |
|---|---|---|
| Updater signing private key (`myapp.key`, minisign ID `8A406F2CA93B6BCC`) and its password | `%USERPROFILE%\.secrets\student-invoice\` plus the owner's password manager | Release builds, to sign the MSI |
| Google OAuth Desktop client (`google-oauth-client.json`, Google's download format) | same folder plus the password manager | Compiled into builds by `app/src-tauri/build.rs` (see [Gmail](gmail.md)) |
| Gemini API key (design tooling only) | same folder | The icon-generation script (planned) |

Rules:

- Create and edit these files yourself (for example in Notepad). Never paste
  secrets into chat, issues or commit messages, and never pass them as
  command-line arguments, where they show up in process lists and logs.
- Scripts read secret files in-process and never print them.
- Claude Code is denied read access to `~/.secrets/**` in the owner's user
  settings.
- Commits are scanned by `scripts/check-secrets.mjs` in the pre-commit hook
  and in CI, and by gitleaks in CI. GitHub secret scanning and push
  protection are enabled on the repository.

**If a secret leaks:**

- **Google client secret:** in Google Cloud Console, *Add secret*, give users
  the new one (or ship it), then disable and delete the old one.
- **Signing key:** the key cannot be rotated without stranding every
  installed copy (see [compatibility](compatibility.md)). Keep it offline and
  backed up.

## The public updater key is not a secret

The `pubkey` in `app/src-tauri/tauri.conf.json` is the public half. Anyone can
see it. It only lets installed apps verify that an update was signed by the
private key.

## Secrets the app holds at runtime

- **Gmail refresh token:** stored in Windows Credential Manager
  (`com.isaac.student-invoice` / `google-account`, persistence *Local*). The
  access token is held only in memory in the Rust process. Neither ever
  reaches the webview.
- **Custom Google OAuth client** (optional, advanced): stored in Credential
  Manager (`google-oauth-client`), never in localStorage.
- **Logs:** the app never logs or displays codes, tokens or secrets. Structs
  holding them have redacting `Debug` implementations.

## Webview boundary

- **Content:** the webview loads only the bundled UI from
  `http://tauri.localhost`. No remote pages are loaded.
- **Content Security Policy** (`app/src-tauri/tauri.conf.json`):
  - `default-src 'self'` and `script-src 'self'`;
  - `connect-src` limited to Tauri IPC and `https://api.emailjs.com`;
  - `object-src`, `base-uri`, `form-action` and `frame-ancestors` set to
    `'none'`;
  - inline styles are allowed, because Radix components inject style tags,
    so Tauri's style hashing is disabled for `style-src`.
- **Prototype freezing:** `freezePrototype` is on.
- **Command allowlist:**
  - `app/src-tauri/build.rs` declares the app's commands (ACL manifest).
  - Only commands granted an `allow-*` permission in
    `app/src-tauri/capabilities/default.json` can be called; see
    [architecture](architecture.md#capabilities-permissions-granted-to-the-window).
  - Core permissions are limited to reading the app version and listening
    to events.
  - There are no filesystem, shell, HTTP or opener permissions in the
    webview. URLs are opened by Rust.
- **Files:** the webview can't read or write arbitrary files. Export and import use native dialogs opened by Rust, and automatic backups are addressed by strictly checked names. Imported files are size-limited and strictly validated ([backup](backup.md)).
- **Input checks:** commands validate their input (length limits, email
  address format, OAuth client ID shape) before acting.
- **Text rendering:** user-entered text is rendered as text by React (no
  `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere).

## Network destinations

- `accounts.google.com` and `oauth2.googleapis.com`: OAuth sign-in.
- `gmail.googleapis.com`: create drafts.
- `github.com`: update checks and downloads (minisign-verified).
- `api.emailjs.com`: feedback form.
