# Architecture

Student Invoice is a Windows desktop app built with **Tauri v2**: a Rust
process hosts a WebView2 window that runs a **React + TypeScript** single-page
UI. The UI does almost everything; Rust handles what the browser sandbox
can't: the Google OAuth loopback server, Gmail API calls, and the updater.

```
┌──────────────────────── WebView2 (origin http://tauri.localhost) ───────────────────────┐
│ React UI (app/src)                                                                      │
│   App.tsx ── components/* ── zustand store (stores/app-store.ts) ── utils/* (pure logic) │
│        │                         │ persist → localStorage "student-invoice-store"        │
│        │ lib/backend.ts (typed invoke wrappers; CSP + command allowlist enforced)        │
└────────┼────────────────────────────────────────────────────────────────────────────────┘
         ▼ Tauri IPC
┌──────── Rust (app/src-tauri/src) ─────────┐      ┌──────────── Internet ────────────┐
│ commands.rs → google/ (sign-in, drafts)    │ ───▶ │ accounts.google.com (OAuth)      │
│             → updates.rs                   │ ───▶ │ gmail.googleapis.com (drafts)    │
│ google/store.rs → Windows Credential Mgr   │ ───▶ │ github.com releases (updates)    │
│ plugins: opener (Rust-side), updater       │      └──────────────────────────────────┘
└────────────────────────────────────────────┘
The feedback form calls api.emailjs.com directly from the webview.
```
## Frontend (`app/src`)

- `main.tsx` mounts `App` in React StrictMode, inside an error boundary
  (`components/error-boundary.tsx`).
- `App.tsx` is the whole UI today: header, template picker and actions, invoice
  preview, and all dialogs. See [UI](ui.md).
- `stores/app-store.ts`: the single zustand store. It holds templates, settings,
  the current term and invoice, Gmail connection state, and the update
  actions, and it persists part of itself to localStorage. See
  [data model](data-model.md).
- `utils/terms.ts` and `utils/invoice-generator.ts`: pure, tested billing logic.
  See [billing](billing.md).
- `types/index.ts`: shared domain types.
- `lib/backend.ts`: typed wrappers for every Rust command and the shared
  `{ kind, message }` error type. The UI calls these instead of `invoke`.

**Start-up side effects:**
- **When the store module loads** (bottom of `app/src/stores/app-store.ts`):
  it loads the stored state, computes the current term (which also builds the
  current invoice), and asks Rust for the Gmail status.
- **When `App` mounts:** it upgrades data from older versions, after a backup
  if there is data to protect (`migrateStoredData`), takes the daily automatic backup
  (`ensureDailyBackup`), starts listening for update progress, and checks for
  updates.

## Backend (`app/src-tauri`)

- `src/main.rs` calls `student_invoice_tauri_lib::run()`.
- `src/lib.rs` registers the plugins and the commands below. It also creates
  the shared state: the Google sign-in manager, holding one HTTP client, and
  the updater state.
- `src/commands.rs` holds every command the UI can call. They validate input
  and delegate.
- `src/error.rs` defines `AppError`, which reaches the UI as `{ kind, message }`.
- `src/google/` covers Google sign-in, token storage in Windows Credential
  Manager, and Gmail drafts. See [Gmail](gmail.md).
- `src/updates.rs` handles update checks and installs (see Updates below).
- `build.rs` does two things:
  - declares the command allowlist (the app ACL manifest);
  - embeds the Google OAuth client from the release environment or the
    owner's secrets folder.
- `tauri.conf.json` holds the window, security (CSP), updater and bundle
  settings. Several of these values are frozen; see [compatibility](compatibility.md).
- `tauri.dev.conf.json` is a development-only overlay, merged by
  `pnpm dev:mcp`, that enables the Tauri MCP bridge (see
  [development](development.md#claude-code)). Release builds never use it.

### Commands callable from the UI

<!-- GEN:tauri-commands -->
Only commands granted an `allow-<command>` permission in `app/src-tauri/capabilities/` can be called from the webview.

| Command | Arguments | Returns | Purpose | Defined at |
|---|---|---|---|---|
| `check_for_updates` | — | `AppResult<UpdateInfo>` | Checks GitHub for a newer version (disabled in development builds). | `src/commands.rs:99` |
| `create_auto_backup` | `reason: BackupReason`<br>`content: String` | `AppResult<BackupInfo>` | Saves an automatic backup in the app's backups folder. | `src/commands.rs:130` |
| `export_backup` | `content: String`<br>`suggested_name: String` | `AppResult<Option<String>>` | Asks where to save and writes an export of all data; returns the file name, or null if cancelled. | `src/commands.rs:114` |
| `gmail_cancel_connect` | — | `()` | Cancels a sign-in that is waiting for the browser. | `src/commands.rs:30` |
| `gmail_clear_custom_client` | — | `AppResult<GmailStatus>` | Goes back to the built-in Google OAuth client. | `src/commands.rs:93` |
| `gmail_connect` | — | `AppResult<GmailStatus>` | Signs in with Google in the browser; resolves when finished, cancelled or timed out. | `src/commands.rs:24` |
| `gmail_create_draft` | `subject: String`<br>`body: String`<br>`to: Option<String>` | `AppResult<DraftCreated>` | Saves one invoice as a Gmail draft (optionally addressed to `to`). | `src/commands.rs:42` |
| `gmail_disconnect` | — | `AppResult<GmailStatus>` | Revokes Gmail access and forgets the account on this PC. | `src/commands.rs:36` |
| `gmail_set_custom_client` | `client_id: String`<br>`client_secret: String` | `AppResult<GmailStatus>` | Uses the user's own Google OAuth client instead of the built-in one (advanced). | `src/commands.rs:66` |
| `gmail_status` | — | `AppResult<GmailStatus>` | Gmail connection status (connected account, whether Gmail is set up). | `src/commands.rs:18` |
| `import_backup` | — | `AppResult<Option<String>>` | Asks for a backup file and returns its contents, or null if cancelled. | `src/commands.rs:124` |
| `install_update` | — | `AppResult<()>` | Downloads and installs the update found by the last check; the app then exits. | `src/commands.rs:108` |
| `list_backups` | — | `AppResult<Vec<BackupInfo>>` | Lists automatic backups, newest first. | `src/commands.rs:140` |
| `open_backups_folder` | — | `AppResult<()>` | Opens the automatic backups folder in File Explorer. | `src/commands.rs:152` |
| `read_backup` | `name: String` | `AppResult<String>` | Reads one automatic backup by name. | `src/commands.rs:146` |
<!-- /GEN:tauri-commands -->

### Capabilities (permissions granted to the window)

<!-- GEN:capabilities -->
**`app/src-tauri/capabilities/default.json`** (identifier `default`, windows: `main`)

- `core:app:allow-version`
- `core:event:allow-listen`
- `core:event:allow-unlisten`
- `allow-gmail-status`
- `allow-gmail-connect`
- `allow-gmail-cancel-connect`
- `allow-gmail-disconnect`
- `allow-gmail-create-draft`
- `allow-gmail-set-custom-client`
- `allow-gmail-clear-custom-client`
- `allow-check-for-updates`
- `allow-install-update`
- `allow-export-backup`
- `allow-import-backup`
- `allow-create-auto-backup`
- `allow-list-backups`
- `allow-read-backup`
- `allow-open-backups-folder`
<!-- /GEN:capabilities -->

## Updates

These live in `app/src-tauri/src/updates.rs`.

1. **On start-up** the UI calls `check_for_updates`. This asks GitHub for
   `latest.json`, with a 60-second timeout, and remembers the update it found.
   If a newer version exists, the "Updates" button is highlighted.
2. **When the user clicks it**, the dialog shows the version and notes.
3. **"Install Update"** calls `install_update`, which installs exactly the
   update that was shown:
   - it downloads the MSI and sends `update://progress` events for the
     progress text;
   - it verifies the minisign signature against the public key in
     `tauri.conf.json`;
   - it runs the MSI with `msiexec /passive`, and the app exits.
4. **Development builds** skip the check (`disabledInDev`), so they can
   never install a production MSI.
5. **Minimum supported version:** if a future `latest.json` contains
   `minimumSupportedVersion`, the check reports `required: true`. This is a
   dormant safety net for security emergencies, see
   [decision 0002](decisions/0002-no-forced-updates.md).

The release side is described in [release](release.md), and the rules that
keep old installs updatable are in [compatibility](compatibility.md).
