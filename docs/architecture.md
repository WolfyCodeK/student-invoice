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
│        │ invoke('<command>')     │                                                       │
└────────┼─────────────────────────┼───────────────────────────────────────────────────────┘
         ▼ Tauri IPC
┌──────── Rust (app/src-tauri/src) ────────┐      ┌──────────── Internet ────────────┐
│ lib.rs: commands, OAuth loopback server,  │ ───▶ │ accounts.google.com (OAuth)      │
│         updater commands                  │ ───▶ │ gmail.googleapis.com (drafts)    │
│ gmail.rs: OAuth + Gmail draft client      │ ───▶ │ github.com releases (updates)    │
│ plugins: opener, updater                  │      └──────────────────────────────────┘
└───────────────────────────────────────────┘
The feedback form calls api.emailjs.com directly from the webview.
```

## Frontend (`app/src`)

- `main.tsx` mounts `App` in React StrictMode.
- `App.tsx` is the whole UI today: header, template picker and actions, invoice
  preview, and all dialogs. See [UI](ui.md).
- `stores/app-store.ts`: the single zustand store. It holds templates, settings,
  the current term and invoice, Gmail connection state, and the update
  actions, and it persists part of itself to localStorage. See
  [data model](data-model.md).
- `utils/terms.ts` and `utils/invoice-generator.ts`: pure, tested billing logic.
  See [billing](billing.md).
- `types/index.ts`: shared domain types.

**Start-up side effects** (`app/src/stores/app-store.ts`, bottom of file): as
soon as the store module loads it computes the current term, and after one
second it asks Rust for the Gmail status.

## Backend (`app/src-tauri`)

- `src/main.rs` calls `student_invoice_tauri_lib::run()`.
- `src/lib.rs` registers the plugins (`opener`, `updater`) and the commands
  below. It keeps Gmail state (client credentials and tokens) in a global
  in-memory mutex, so nothing is written to disk. See [Gmail](gmail.md).
- `src/gmail.rs` is the OAuth2 (PKCE) and Gmail drafts client.
- `tauri.conf.json` holds the window, security (CSP), updater and bundle
  settings. Several of these values are frozen; see [compatibility](compatibility.md).
- `tauri.dev.conf.json` is a development-only overlay, merged by
  `pnpm dev:mcp`, that enables the Tauri MCP bridge (see
  [development](development.md#claude-code)). Release builds never use it.

### Commands callable from the UI

<!-- GEN:tauri-commands -->
**No app ACL manifest yet:** every registered command can be called by any script running in the webview.

| Command | Arguments | Returns | Purpose | Defined at |
|---|---|---|---|---|
| `check_for_updates` | — | `Result<String, String>` | — | `src/lib.rs:245` |
| `check_gmail_auth_status` | — | `Result<serde_json::Value, String>` | — | `src/lib.rs:120` |
| `create_gmail_draft` | `subject: String`<br>`body: String` | `Result<serde_json::Value, String>` | — | `src/lib.rs:75` |
| `exchange_gmail_code` | `code: String`<br>`pkce_verifier: String`<br>`client_id: String`<br>`client_secret: String` | `Result<(), String>` | — | `src/lib.rs:54` |
| `get_gmail_auth_url` | `client_id: String`<br>`client_secret: String` | `Result<(String, String), String>` | — | `src/lib.rs:33` |
| `greet` | `name: &str` | `String` | — | `src/lib.rs:28` |
| `install_update` | — | `Result<(), String>` | — | `src/lib.rs:288` |
| `is_gmail_authenticated` | — | `Result<bool, String>` | — | `src/lib.rs:114` |
| `start_oauth_server` | `client_id: String`<br>`client_secret: String` | `Result<String, String>` | — | `src/lib.rs:133` |
<!-- /GEN:tauri-commands -->

### Capabilities (permissions granted to the window)

<!-- GEN:capabilities -->
**`app/src-tauri/capabilities/default.json`** (identifier `default`, windows: `main`)

- `core:default`
- `opener:default`
<!-- /GEN:capabilities -->

## Updates

On start-up the UI calls `check_for_updates`. When a newer version exists, the
"Updates" button turns green. Clicking it shows the version and notes.
"Install Update" calls `install_update`, which downloads the MSI named in
`latest.json`, verifies its minisign signature against the public key in
`tauri.conf.json`, runs it with `msiexec /passive`, and exits the app. The
release side is described in [release](release.md), and the rules that keep
old installs updatable are in [compatibility](compatibility.md).
