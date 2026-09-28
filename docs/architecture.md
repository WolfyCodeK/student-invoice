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
│ plugins: opener, dialog (Rust-side),       │      └──────────────────────────────────┘
│          updater, single-instance          │
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
  actions, including the check that asks before unsaved changes are
  discarded (`useLeaveGuard`). `lib/appearance.ts` handles the colour
  scheme, corners and light or dark (and the reduced-motion check). `lib/format.ts` formats money and
  lesson counts for display, and `lib/term-display.ts` names and compares
  half-terms for the screens.
- `stores/app-store.ts`: the single zustand store. It holds templates, settings,
  the current term, the live Gmail status, Draft all's results
  (`draftResults`, not persisted, so they survive leaving the register), and
  the drafting, deleting (`deleteFamily`, backup first) and install actions.
  It persists part of itself to localStorage through its own storage, which
  sets unreadable data aside instead of overwriting it. See
  [data model](data-model.md). Invoices are never stored: `invoiceFor()`
  builds a family's invoice from its template, the current term and the
  email wording settings (the custom body and Your name) whenever a screen
  or a draft needs it (the register memoises them per render).
  `needsYourName()` says when the wording needs a name that isn't set yet;
  the drafting actions then refuse with `YOUR_NAME_NEEDED`
  ([UI](ui.md#your-name)).
- `utils/terms.ts` and `utils/invoice-generator.ts`: pure, tested billing logic.
  See [billing](billing.md).
- `types/index.ts`: shared domain types.
- **Loaded on first use:** Settings, the family editor, the feedback form,
  What's new, "Choose how it looks" and the tour are code-split
  (`React.lazy`), and the first three are prefetched when idle (within a
  second of start-up). Backup
  parsing, which needs zod, is only imported by the Settings screen's Data
  section, so it loads with that screen. See
  [performance](performance.md).
- `lib/backend.ts`: typed wrappers for every Rust command and the shared
  `{ kind, message }` error type. The UI calls these instead of `invoke`.

**Start-up side effects:**
- **When the store module loads** (`app/src/stores/app-store.ts`): it loads
  the stored state (copying it aside first if it can't be read), sets the
  current term from today's date and any edited term dates, and asks Rust for
  the Gmail status (following a sign-in that a reload left pending, see
  [Gmail](gmail.md#status-and-disconnect)). It also sets one timer to just
  after midnight and listens for the window coming back into view, to work
  the half-term out again if the date has moved on (`refreshCurrentTerm`;
  [billing](billing.md#where-the-logic-lives)).
- **When `App` mounts:** it says once if the stored data couldn't be read;
  clears v1.0.1's plaintext Google credentials and upgrades data from older
  versions, after a backup if there is data to protect
  (`migrateStoredData`); takes the daily automatic backup
  (`ensureDailyBackup`); and checks for updates (`features/updates/use-updates.ts`).
  Once the data is ready, it shows What's new, and after 1.1.0 "Choose how
  it looks" and the tour, if this PC hasn't seen them yet
  ([UI](ui.md#whats-new-and-the-tour)).

## Backend (`app/src-tauri`)

- `src/main.rs` calls `student_invoice_tauri_lib::run()`.
- `src/lib.rs` registers the plugins and the commands below. In release
  builds the single-instance plugin comes first, so opening the app again
  focuses the running window instead of starting a second copy (see
  [performance](performance.md#low-memory-mode)). It also creates
  the shared state: the Google sign-in manager, holding one HTTP client, and
  the updater state. It then creates the main window itself from the
  `tauri.conf.json` config (`"create": false`), so the WebView2 arguments can
  follow the user's Low memory mode choice (see
  [performance](performance.md#low-memory-mode)). It also fits the start-up
  size to the screen's free area (`fit_to_screen`), and records the
  preferences the window was started with. If WebView2 fails to create the
  window, start-up stops rather than leaving an invisible process. The window
  has no Windows frame, because the UI draws its own title bar
  ([UI](ui.md#title-bar)).
- `src/preferences.rs` holds per-PC preferences read before the window
  exists (`preferences.json`).
- `src/commands.rs` holds every command the UI can call. They validate input
  and delegate. Commands that touch files are declared
  `#[tauri::command(async)]`, so they run on Tauri's thread pool instead of
  the main thread: a slow disk or antivirus scan can't freeze the window
  (dragging, resizing) or hold up other calls.
- `src/error.rs` defines `AppError`, which reaches the UI as `{ kind, message }`.
- `src/google/` covers Google sign-in, token storage in Windows Credential
  Manager, and Gmail drafts. See [Gmail](gmail.md).
- `src/updates.rs` handles update checks and installs (see Updates below).
- `build.rs` does two things:
  - declares the command allowlist (the app ACL manifest);
  - embeds the Google OAuth client from the release environment or the
    owner's secrets folder, through a generated file it never prints (see
    [Gmail](gmail.md#which-oauth-client-is-used)).
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
| `check_for_updates` | — | `AppResult<UpdateInfo>` | Checks GitHub for a newer version (disabled in development builds). | `src/commands.rs:90` |
| `create_auto_backup` | `reason: BackupReason`<br>`content: String` | `AppResult<BackupInfo>` | Saves an automatic backup in the app's backups folder. | `src/commands.rs:121` |
| `export_backup` | `content: String`<br>`suggested_name: String` | `AppResult<Option<String>>` | Asks where to save and writes an export of all data; returns the file name, or null if cancelled. | `src/commands.rs:105` |
| `get_preferences` | — | `PreferencesStatus` | Device preferences: the saved low memory mode choice, and the one this window started with. | `src/commands.rs:149` |
| `gmail_cancel_connect` | — | `()` | Cancels a sign-in that is waiting for the browser. | `src/commands.rs:30` |
| `gmail_clear_custom_client` | — | `AppResult<GmailStatus>` | Goes back to the built-in Google OAuth client. | `src/commands.rs:84` |
| `gmail_connect` | — | `AppResult<GmailStatus>` | Signs in with Google in the browser; resolves when finished, cancelled or timed out. | `src/commands.rs:24` |
| `gmail_create_draft` | `subject: String`<br>`body: String` | `AppResult<DraftCreated>` | Saves one invoice as a Gmail draft. | `src/commands.rs:42` |
| `gmail_disconnect` | — | `AppResult<GmailStatus>` | Revokes Gmail access and forgets the account on this PC. | `src/commands.rs:36` |
| `gmail_set_custom_client` | `client_id: String`<br>`client_secret: String` | `AppResult<GmailStatus>` | Uses the user's own Google OAuth client instead of the built-in one (advanced). | `src/commands.rs:57` |
| `gmail_status` | — | `AppResult<GmailStatus>` | Gmail connection status (connected account, whether Gmail is set up). | `src/commands.rs:18` |
| `import_backup` | — | `AppResult<Option<String>>` | Asks for a backup file and returns its contents, or null if cancelled. | `src/commands.rs:115` |
| `install_update` | — | `AppResult<()>` | Downloads and installs the update found by the last check; the app then exits. | `src/commands.rs:99` |
| `list_backups` | — | `AppResult<Vec<BackupInfo>>` | Lists automatic backups, newest first. | `src/commands.rs:131` |
| `open_backups_folder` | — | `AppResult<()>` | Opens the automatic backups folder in File Explorer. | `src/commands.rs:143` |
| `read_backup` | `name: String` | `AppResult<String>` | Reads one automatic backup by name. | `src/commands.rs:137` |
| `restart_app` | — | `()` | Restarts the app (used to apply low memory mode). | `src/commands.rs:164` |
| `set_low_memory_mode` | `enabled: bool` | `AppResult<PreferencesStatus>` | Turns low memory mode on or off; takes effect after a restart. | `src/commands.rs:155` |
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
   If a newer version exists, the Updates button in the title bar gets a
   dot, and once What's new and the tour are out of the way a notice in the
   bottom corner says so, once ([UI](ui.md#toasts)). Nothing opens by itself
   unless the update is marked important.
2. **When the user clicks the Updates button** (or Install update on the
   notice), the dialog (`features/updates/update-dialog.tsx`) shows the
   version and notes; from the notice it starts installing straight away.
3. **"Install update"** calls `install_update`, which installs exactly the
   update that was shown:
   - it downloads the MSI and sends `update://progress` events, which the
     dialog shows as a progress bar. Events are throttled to one per whole
     percent (or one per 100 ms when the size is unknown), plus the final
     state, so a download doesn't flood the UI with hundreds of events;
   - the whole download must finish within 10 minutes (enough for about
     9 KB/s); a stalled download ends with "The update took too long to
     download…" instead of hanging the dialog;
   - it verifies the minisign signature against the public key in
     `tauri.conf.json`;
   - it runs the MSI with `msiexec /passive`, and the app exits.
4. **Development builds** skip the check (`disabledInDev`), so they can
   never install a production MSI.
5. **Minimum supported version:** if `latest.json` contains a
   `minimumSupportedVersion` above the running version, the check reports
   `required: true` (`below_minimum`, unit-tested; anything unreadable counts
   as not required). The update dialog then opens at every start, saying it's
   an important update. "Not now" still works, so nothing is forced. This is
   a safety net for security emergencies only: see
   [decision 0002](decisions/0002-no-forced-updates.md), and
   [release](release.md#emergency-mark-old-versions-as-unsupported) for how
   to set it.

The release side is described in [release](release.md), and the rules that
keep old installs updatable are in [compatibility](compatibility.md).
