# Architecture

Student Invoice is a Windows desktop app built with **Tauri v2**: a Rust
process hosts a WebView2 window that runs a **React + TypeScript** single-page
UI. The UI does almost everything; Rust handles what the browser sandbox
can't: the Google OAuth loopback server, Gmail API calls, and the updater.

```
┌──────────────────────── WebView2 (origin http://tauri.localhost) ───────────────────────┐
│ React UI (app/src)                                                                      │
│   App.tsx ── features/*, components/* ── zustand store (stores/) ── utils/* (pure logic) │
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
- `App.tsx` is the shell: the title bar, the current screen (register,
  settings or the family editor), and the app-wide dialogs. The screens are
  in `features/`, the title bar and shared pieces in `components/`, and the
  styles in `styles/`. See [UI](ui.md).
- `features/app-context.tsx` gives every screen navigation and shared
  actions. `lib/appearance.ts` handles the colour scheme, corners and light
  or dark.
- `stores/app-store.ts`: the single zustand store. It holds templates, settings,
  the current term and invoice, Gmail connection state, and the update
  actions, and it persists part of itself to localStorage. See
  [data model](data-model.md).
- `utils/terms.ts` and `utils/invoice-generator.ts`: pure, tested billing logic.
  See [billing](billing.md).
- `types/index.ts`: shared domain types.
- **Loaded on first use:** Settings, the family editor, the feedback form,
  What's new and the tour are code-split (`React.lazy`), and the first three
  are prefetched when idle. Backup
  parsing, which needs zod, is imported on demand. See
  [performance](performance.md).
- `lib/backend.ts`: typed wrappers for every Rust command and the shared
  `{ kind, message }` error type. The UI calls these instead of `invoke`.

**Start-up side effects:**
- **When the store module loads** (bottom of `app/src/stores/app-store.ts`):
  it loads the stored state, computes the current term (which also builds the
  current invoice), and asks Rust for the Gmail status.
- **When `App` mounts:** it upgrades data from older versions, after a backup
  if there is data to protect (`migrateStoredData`), takes the daily automatic backup
  (`ensureDailyBackup`), starts listening for update progress, and checks for
  updates. Once the data is ready, it shows What's new, and the tour after
  1.1.0, if this PC hasn't seen them yet.

## Backend (`app/src-tauri`)

- `src/main.rs` calls `student_invoice_tauri_lib::run()`.
- `src/lib.rs` registers the plugins and the commands below. It also creates
  the shared state: the Google sign-in manager, holding one HTTP client, and
  the updater state. It then creates the main window itself from the
  `tauri.conf.json` config (`"create": false`), so the WebView2 arguments can
  follow the user's Low memory mode choice (see
  [performance](performance.md#low-memory-mode)). It also fits the start-up
  size to the screen's free area (`fit_to_screen`). The window has no Windows
  frame, because the UI draws its own title bar ([UI](ui.md#title-bar)).
- `src/preferences.rs` holds per-PC preferences read before the window
  exists (`preferences.json`).
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
- `Cargo.toml` has a size-tuned release profile (LTO, `opt-level = "s"`,
  stripped); see [performance](performance.md).
- `tauri.dev.conf.json` is a development-only overlay, merged by
  `pnpm dev:mcp`, that enables the Tauri MCP bridge (see
  [development](development.md#claude-code)). Release builds never use it.

### Commands callable from the UI

<!-- GEN:tauri-commands -->
Only commands granted an `allow-<command>` permission in `app/src-tauri/capabilities/` can be called from the webview.

| Command | Arguments | Returns | Purpose | Defined at |
|---|---|---|---|---|
| `check_for_updates` | — | `AppResult<UpdateInfo>` | Checks GitHub for a newer version (disabled in development builds). | `src/commands.rs:100` |
| `create_auto_backup` | `reason: BackupReason`<br>`content: String` | `AppResult<BackupInfo>` | Saves an automatic backup in the app's backups folder. | `src/commands.rs:131` |
| `export_backup` | `content: String`<br>`suggested_name: String` | `AppResult<Option<String>>` | Asks where to save and writes an export of all data; returns the file name, or null if cancelled. | `src/commands.rs:115` |
| `get_preferences` | — | `Preferences` | Device preferences (e.g. low memory mode). | `src/commands.rs:159` |
| `gmail_cancel_connect` | — | `()` | Cancels a sign-in that is waiting for the browser. | `src/commands.rs:31` |
| `gmail_clear_custom_client` | — | `AppResult<GmailStatus>` | Goes back to the built-in Google OAuth client. | `src/commands.rs:94` |
| `gmail_connect` | — | `AppResult<GmailStatus>` | Signs in with Google in the browser; resolves when finished, cancelled or timed out. | `src/commands.rs:25` |
| `gmail_create_draft` | `subject: String`<br>`body: String`<br>`to: Option<String>` | `AppResult<DraftCreated>` | Saves one invoice as a Gmail draft (optionally addressed to `to`). | `src/commands.rs:43` |
| `gmail_disconnect` | — | `AppResult<GmailStatus>` | Revokes Gmail access and forgets the account on this PC. | `src/commands.rs:37` |
| `gmail_set_custom_client` | `client_id: String`<br>`client_secret: String` | `AppResult<GmailStatus>` | Uses the user's own Google OAuth client instead of the built-in one (advanced). | `src/commands.rs:67` |
| `gmail_status` | — | `AppResult<GmailStatus>` | Gmail connection status (connected account, whether Gmail is set up). | `src/commands.rs:19` |
| `import_backup` | — | `AppResult<Option<String>>` | Asks for a backup file and returns its contents, or null if cancelled. | `src/commands.rs:125` |
| `install_update` | — | `AppResult<()>` | Downloads and installs the update found by the last check; the app then exits. | `src/commands.rs:109` |
| `list_backups` | — | `AppResult<Vec<BackupInfo>>` | Lists automatic backups, newest first. | `src/commands.rs:141` |
| `open_backups_folder` | — | `AppResult<()>` | Opens the automatic backups folder in File Explorer. | `src/commands.rs:153` |
| `read_backup` | `name: String` | `AppResult<String>` | Reads one automatic backup by name. | `src/commands.rs:147` |
| `restart_app` | — | `()` | Restarts the app (used to apply low memory mode). | `src/commands.rs:174` |
| `set_low_memory_mode` | `enabled: bool` | `AppResult<Preferences>` | Turns low memory mode on or off; takes effect after a restart. | `src/commands.rs:165` |
<!-- /GEN:tauri-commands -->

### Capabilities (permissions granted to the window)

<!-- GEN:capabilities -->
**`app/src-tauri/capabilities/default.json`** (identifier `default`, windows: `main`)

- `core:app:allow-version`
- `core:event:allow-listen`
- `core:event:allow-unlisten`
- `core:window:allow-minimize`
- `core:window:allow-toggle-maximize`
- `core:window:allow-close`
- `core:window:allow-start-dragging`
- `core:window:allow-internal-toggle-maximize`
- `core:window:allow-is-maximized`
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
- `allow-get-preferences`
- `allow-set-low-memory-mode`
- `allow-restart-app`
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
