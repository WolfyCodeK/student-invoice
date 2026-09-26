# Security

This page covers how secrets are handled and the app's security boundaries.
Open issues and their fixes are tracked in the
[security audit](audits/2026-09-security-audit.md).

## Secrets never live in the repository

| Secret | Where it lives | Used by |
|---|---|---|
| Updater signing private key (`myapp.key`, minisign ID `8A406F2CA93B6BCC`) and its password | `%USERPROFILE%\.secrets\student-invoice\` plus the owner's password manager | Release builds, to sign the MSI |
| Google OAuth Desktop client (`google-oauth-client.json`, Google's download format) | same folder plus the password manager | Release builds (planned), manual testing |
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

## Webview boundary (current state)

- The webview loads only the bundled UI from `http://tauri.localhost`. No
  remote pages are loaded.
- Permissions granted to the window are listed in
  [architecture](architecture.md#capabilities-permissions-granted-to-the-window).
  There are currently no filesystem, shell or HTTP plugin permissions.
- There is not yet a Content Security Policy or a command allowlist (audit S4
  and S5), so any script running in the webview could call every command.
- User-entered text is rendered as text by React (no `dangerouslySetInnerHTML`,
  `innerHTML` or `eval` anywhere).

## Network destinations

- `accounts.google.com` and `oauth2.googleapis.com`: OAuth sign-in.
- `gmail.googleapis.com`: create drafts.
- `github.com`: update checks and downloads (minisign-verified).
- `api.emailjs.com`: feedback form.
