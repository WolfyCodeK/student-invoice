# Compatibility and update safety

Users update through the in-app **Updates** button. Nobody can be forced to
update, and older versions (v1.0.1 in particular) can't be patched after
release. So every release must:

1. be installable over **any** earlier version through the in-app updater;
2. keep **all** user data (templates, settings, theme) untouched or migrated
   additively;
3. leave anyone who **doesn't** update with a working app.

## Invariants

These values are enforced by `scripts/check-invariants.mjs`. It runs in CI,
in the pre-commit hook and in the release script, and reads its rules from
`scripts/invariants.config.mjs`. The table below is generated from the same
file.

<!-- GEN:invariants -->
| Id | What | Must be | Why |
|---|---|---|---|
| `identifier` | `identifier` in `app/src-tauri/tauri.conf.json` | `com.isaac.student-invoice` | Names the WebView2 data folder (`%LOCALAPPDATA%\com.isaac.student-invoice`) that holds all user data. |
| `https-scheme` | `useHttpsScheme` on every window | absent or `false` | Changing it moves the page origin away from `http://tauri.localhost`, so localStorage (all user data) appears empty. |
| `product-name` | `productName` | `Student Invoice` | Install folder, Start-menu entry and registry key derive from it. |
| `publisher` | `bundle.publisher` | `isaac` | MSI Manufacturer and the `HKCU\Software\isaac\Student Invoice` registry path. |
| `upgrade-code` | `bundle.windows.wix.upgradeCode` | `236f3e14-f18d-5eff-88a5-407aa14b96c8` | Must equal the code in every shipped MSI (verified against v1.0.1) or the installer adds a second copy instead of upgrading. |
| `binary-name` | Cargo package `name` in `app/src-tauri/Cargo.toml`, and no `mainBinaryName` | `student-invoice-tauri` | Sets the installed exe name; changing it breaks users' pinned shortcuts. |
| `updater-endpoint` | `plugins.updater.endpoints` | exactly the GitHub `releases/latest/download/latest.json` URL | Baked into every installed copy; the only place they look for updates. |
| `updater-pubkey` | `plugins.updater.pubkey` | minisign key `8A406F2CA93B6BCC` | Installed copies only accept updates signed by this key. The private key lives outside the repo (see docs/release.md). |
| `install-mode` | `plugins.updater.windows.installMode` and `bundle.targets` | `passive`; targets exactly `["msi"]` | v1.0.1's updater installs the MSI from latest.json's `windows-x86_64` entry. An NSIS installer would create a second, per-user install. |
| `global-tauri` | `app.withGlobalTauri` in the shipped config | absent or `false` | Only the dev-only config overlay may enable it (for the Tauri MCP bridge). Shipping it widens the attack surface. |
| `mcp-bridge-dev-only` | Tauri MCP bridge (`tauri-plugin-mcp-bridge`) | optional Cargo dependency behind the non-default `mcp-bridge` feature, registered only under `cfg(all(debug_assertions, feature = "mcp-bridge"))`, bound to 127.0.0.1, and granted only in `tauri.dev.conf.json` | It lets a local tool drive the app. It must never reach users' machines, and even in dev it must not listen on the network. |
| `store-key` | zustand persist `name` and `version` in `app/src/stores/app-store.ts` | `student-invoice-store`, version 0 (default) | Where all templates/settings live. zustand wipes stored data when the version differs and there is no migration, so bumping it would also make a downgrade to v1.0.1 destroy data. Schema changes must be additive (docs/data-model.md). |
| `theme-key` | Theme localStorage key | `student-invoice-theme` | Users' light/dark choice. |
| `versions-match` | App version in `package.json`, `Cargo.toml`, `tauri.conf.json` | all equal | The updater compares the Tauri version; the UI shows the package version. |
| `no-secrets-tracked` | Tracked files | no `.env*` (except `.env.example`), `*.key`, `*.key.pub`, `client_secret*.json`, `google-oauth*.json` (`scripts/lib/secret-files.mjs`) | Secrets live in `%USERPROFILE%\.secrets\student-invoice` (docs/security.md). |
<!-- /GEN:invariants -->

## The `latest.json` notes rule

The live `latest.json` (a release asset) is read by **every** installed
version. v1.0.1 splices its `notes` field unescaped into a JSON string and
parses it, so notes containing a quote, backslash, newline or other control
character would make update checks fail for every v1.0.1 user, permanently.
The release script therefore restricts `notes` to one short plain line.
Punctuation is limited to `. , : ; ( ) / # + _ -`. The full changelog goes in
the GitHub release description instead, which the app never parses.

## Things that would break older installs (don't)

- Making the GitHub repository or its releases private: installed copies
  download `latest.json` and the MSI anonymously.
- Deleting old release assets or the EmailJS service/template used by
  v1.0.1's feedback form.
- Deleting the Google OAuth client that users have pasted into v1.0.1's
  Settings without first giving them the replacement credentials.
- Rotating the updater signing key: v1.0.1 would reject every future update.
  If the key ever leaks, the only remedy is a manual reinstall for all users.
  (Changing the key's *password* is fine: the key stays the same. See
  [release](release.md#the-signing-key-password).)

## Versioning

The version number is `MAJOR.MINOR.PATCH`:

- **MAJOR:** a completely new product.
- **MINOR:** a major change (new features, redesigns).
- **PATCH:** a minor change (fixes, small tweaks).

The updater only offers versions strictly greater than the installed one.

## Downgrades

MSIs allow downgrades, so a user can reinstall an older MSI over a newer one.
Because persisted data only ever changes additively (see
[data model](data-model.md)), an older version still reads data written by a
newer one.
