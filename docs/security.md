# Security

This page covers how secrets are handled and the app's security boundaries.
Open issues and their fixes are tracked in the
[security audit](audits/2026-09-security-audit.md).

## Secrets never live in the repository

| Secret | Where it lives | Used by |
|---|---|---|
| Updater signing private key (`myapp.key`, minisign ID `8A406F2CA93B6BCC`) | `%USERPROFILE%\.secrets\student-invoice\` plus the owner's password manager | Release builds, to sign the MSI |
| The signing key's password | The owner's password manager only. It is typed at a hidden prompt when signing, and never stored on disk | Unlocking `myapp.key` ([release](release.md#the-signing-key-password)) |
| Google OAuth Desktop client (`google-oauth-client.json`, Google's download format) | same folder plus the password manager | Compiled into builds by `app/src-tauri/build.rs`, which writes it to a generated file in the git-ignored `target` folder and never prints it (see [Gmail](gmail.md)) |
| Gemini API key (design tooling only) | same folder | The icon-generation script (planned) |

Rules:

- Create and edit these files yourself (for example in Notepad). Never paste
  secrets into chat, issues or commit messages, and never pass them as
  command-line arguments, where they show up in process lists and logs.
- Scripts read secret files in-process and never print them. Even an
  error about a malformed secret file is reported without the parser's
  message, since that would quote the file.
- Claude Code is denied read access to `~/.secrets/**` in the owner's user
  settings.
- Commits are scanned by `scripts/check-secrets.mjs` in the pre-commit hook
  and in CI, and by gitleaks in CI. The scan reads every file's committed or
  staged content in one `git cat-file` call, with file names listed
  NUL-separated so unusual names are scanned too. The file names that must
  never be committed (`.env*`, key files, Google credential files) are one
  list, `scripts/lib/secret-files.mjs`, shared with the `no-secrets-tracked`
  invariant. GitHub secret scanning and push protection are enabled on the
  repository.

**If a secret leaks:**

- **Google client secret:** in Google Cloud Console, *Add secret*, give users
  the new one (or ship it), then disable and delete the old one.
- **Signing key:** the key cannot be rotated without stranding every
  installed copy (see [compatibility](compatibility.md)). Keep it offline and
  backed up. Its password can be changed at any time, because that
  re-encrypts the same key
  ([release](release.md#the-signing-key-password)). The original password
  was public, because it was hard-coded in the old `Release.ps1`. It was
  replaced on 2026-09-26.

## The public updater key is not a secret

The `pubkey` in `app/src-tauri/tauri.conf.json` is the public half. Anyone can
see it. It only lets installed apps verify that an update was signed by the
private key.

## Secrets the app holds at runtime

- **Gmail refresh token:** stored in Windows Credential Manager
  (`com.isaac.student-invoice` / `google-account`, persistence *Local*; the
  name follows the app's identifier, so test builds with another identifier
  and development builds, which add `.dev`, never touch it). The
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
  - Core permissions are limited to reading the app version, listening to
    events, and the window controls the custom title bar needs: minimise,
    maximise/restore, close, drag and double-click to maximise
    (`core:window:allow-minimize`, `-toggle-maximize`, `-close`,
    `-start-dragging`, `-internal-toggle-maximize`, `-is-maximized`).
  - There are no filesystem, shell, HTTP or opener permissions in the
    webview. URLs are opened by Rust.
- **Files:** the webview can't read or write arbitrary files. Export and import use native dialogs opened by Rust, and automatic backups are addressed by strictly checked names. Imported files are size-limited and strictly validated ([backup](backup.md)).
- **WebView2 start-up arguments:** the page can only switch Low memory mode
  on or off (`set_low_memory_mode(bool)`), which adds or removes the fixed
  `--disable-gpu` argument at the next start. It can't pass arbitrary
  browser arguments. It can also restart the app (`restart_app`), which
  is harmless. See [performance](performance.md#low-memory-mode).
- **Input checks:** commands validate their input (length limits, OAuth
  client ID shape, backup names) before acting.
- **Text rendering:** user-entered text is rendered as text by React (no
  `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere).

## Network destinations

- `accounts.google.com` and `oauth2.googleapis.com`: OAuth sign-in.
- `127.0.0.1` on a random port, only while signing in: the local listener
  that receives Google's redirect. It checks `state`, reads a bounded
  request, and replies only with fixed, HTML-escaped pages, so nothing a
  caller sends can be reflected as markup ([Gmail](gmail.md)).
- `gmail.googleapis.com`: create drafts.
- `github.com`: update checks and downloads (minisign-verified).
- `api.emailjs.com`: feedback form. The service, template and public key
  IDs are public by design. The template's **To Email** is fixed to the
  owner's address (set and checked with a test send on 2026-09-28), so the IDs can't be used to send mail
  anywhere else. The app sends only the message, a sender label and an app
  note. Keep the recipient fixed if the template is ever edited.
