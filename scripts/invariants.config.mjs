// Compatibility invariants: values that must never change, because installed
// copies of the app (including v1.0.1, which can't be patched) depend on them.
// Breaking one either hides users' data or strands them on an old version.
//
// This file is the single source of truth. scripts/check-invariants.mjs
// enforces it (CI, git hooks, release script) and scripts/docs/generate.mjs
// renders it into docs/compatibility.md.

export const UPDATER_PUBKEY =
  'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDhBNDA2RjJDQTkzQjZCQ0MKUldUTWF6dXBMRzlBaXFLNUdXRGJMWHl0Q2NWczFhcVFGbk41SndqeXczVzhEQjJSdDJSYUdTaDQK'

export const UPDATER_ENDPOINT =
  'https://github.com/WolfyCodeK/student-invoice/releases/latest/download/latest.json'

/**
 * latest.json `notes` must match this. v1.0.1 splices the notes, unescaped,
 * into a JSON string it then parses (src-tauri/src/lib.rs in v1.0.1), so a
 * quote, backslash or control character would break update checks for every
 * v1.0.1 install, permanently.
 */
export const LATEST_JSON_NOTES_PATTERN = /^[A-Za-z0-9 .,:;()/#+_-]{1,200}$/

/** @type {{ id: string, what: string, expected: string, why: string }[]} */
export const INVARIANTS = [
  {
    id: 'identifier',
    what: '`identifier` in `app/src-tauri/tauri.conf.json`',
    expected: '`com.isaac.student-invoice`',
    why: 'Names the WebView2 data folder (`%LOCALAPPDATA%\\com.isaac.student-invoice`) that holds all user data.',
  },
  {
    id: 'https-scheme',
    what: '`useHttpsScheme` on every window',
    expected: 'absent or `false`',
    why: 'Changing it moves the page origin away from `http://tauri.localhost`, so localStorage (all user data) appears empty.',
  },
  {
    id: 'data-directory',
    what: '`dataDirectory` on every window',
    expected: 'absent',
    why: 'It moves the WebView2 profile out of `%LOCALAPPDATA%\\com.isaac.student-invoice`, so localStorage (all user data) appears empty.',
  },
  {
    id: 'no-platform-config',
    what: 'Platform config files next to `tauri.conf.json` (`tauri.windows.conf.json`, `Tauri.windows.toml` and the like)',
    expected: 'none',
    why: 'Tauri merges them into builds automatically, so one could silently override any value on this list. (`tauri.dev.conf.json` is fine: it is only merged when named with `--config`.)',
  },
  {
    id: 'product-name',
    what: '`productName`',
    expected: '`Student Invoice`',
    why: 'Install folder, Start-menu entry and registry key derive from it.',
  },
  {
    id: 'publisher',
    what: '`bundle.publisher`',
    expected: '`isaac`',
    why: 'MSI Manufacturer and the `HKCU\\Software\\isaac\\Student Invoice` registry path.',
  },
  {
    id: 'upgrade-code',
    what: '`bundle.windows.wix.upgradeCode`',
    expected: '`236f3e14-f18d-5eff-88a5-407aa14b96c8`',
    why: 'Must equal the code in every shipped MSI (verified against v1.0.1) or the installer adds a second copy instead of upgrading.',
  },
  {
    id: 'binary-name',
    what: 'Cargo package `name` in `app/src-tauri/Cargo.toml`, and no `mainBinaryName`',
    expected: '`student-invoice-tauri`',
    why: 'Sets the installed exe name; changing it breaks users\' pinned shortcuts.',
  },
  {
    id: 'updater-endpoint',
    what: '`plugins.updater.endpoints`',
    expected: 'exactly the GitHub `releases/latest/download/latest.json` URL',
    why: 'Baked into every installed copy; the only place they look for updates.',
  },
  {
    id: 'updater-pubkey',
    what: '`plugins.updater.pubkey`',
    expected: 'minisign key `8A406F2CA93B6BCC`',
    why: 'Installed copies only accept updates signed by this key. The private key lives outside the repo (see docs/release.md).',
  },
  {
    id: 'install-mode',
    what: '`plugins.updater.windows.installMode` and `bundle.targets`',
    expected: '`passive`; targets exactly `["msi"]`',
    why: 'v1.0.1\'s updater installs the MSI from latest.json\'s `windows-x86_64` entry. An NSIS installer would create a second, per-user install.',
  },
  {
    id: 'global-tauri',
    what: '`app.withGlobalTauri` in the shipped config',
    expected: 'absent or `false`',
    why: 'Only the dev-only config overlay may enable it (for the Tauri MCP bridge). Shipping it widens the attack surface.',
  },
  {
    id: 'mcp-bridge-dev-only',
    what: 'Tauri MCP bridge (`tauri-plugin-mcp-bridge`)',
    expected: 'optional Cargo dependency behind the non-default `mcp-bridge` feature, registered only under `cfg(all(debug_assertions, feature = "mcp-bridge"))`, bound to 127.0.0.1, and granted only in `tauri.dev.conf.json`',
    why: 'It lets a local tool drive the app. It must never reach users\' machines, and even in dev it must not listen on the network.',
  },
  {
    id: 'store-key',
    what: 'zustand persist `name` and `version` in `app/src/stores/app-store.ts`',
    expected: '`student-invoice-store`, version 0 (default)',
    why: 'Where all templates/settings live. zustand wipes stored data when the version differs and there is no migration, so bumping it would also make a downgrade to v1.0.1 destroy data. Schema changes must be additive (docs/data-model.md).',
  },
  {
    id: 'theme-key',
    what: 'Theme localStorage key',
    expected: '`student-invoice-theme`',
    why: 'Users\' light/dark choice.',
  },
  {
    id: 'versions-match',
    what: 'App version in `package.json`, `Cargo.toml`, `tauri.conf.json`',
    expected: 'all equal',
    why: 'The updater compares the Tauri version; the UI shows the package version.',
  },
  {
    id: 'no-secrets-tracked',
    what: 'Tracked files',
    expected: 'no `.env*` (except `.env.example`), `*.key`, `*.key.pub`, `client_secret*.json`, `google-oauth*.json` (`scripts/lib/secret-files.mjs`)',
    why: 'Secrets live in `%USERPROFILE%\\.secrets\\student-invoice` (docs/security.md).',
  },
]
