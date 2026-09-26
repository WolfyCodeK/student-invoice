# Development

## Prerequisites (Windows)

- Node.js 22.18 or newer, and pnpm 10 (`corepack enable` picks up the
  version pinned in `app/package.json`).
- Rust stable with `clippy` and `rustfmt`, plus the Visual Studio C++ Build
  Tools ("Desktop development with C++").
- WebView2 Runtime (preinstalled on Windows 10/11).

## First run

```powershell
cd app
pnpm install        # also enables the repo's git hooks (core.hooksPath=.githooks)
pnpm tauri dev      # starts Vite on http://localhost:3000 and the app window
```

`pnpm tauri build` produces a signed MSI and needs the updater signing key
(see [release](release.md)). For a local unsigned check, run
`pnpm tauri build --no-bundle`.

## Repository layout

| Path | What |
|---|---|
| `app/` | The application (React UI in `app/src`, Rust in `app/src-tauri`) |
| `docs/` | These docs (start at [README](README.md)) |
| `scripts/` | Repo tooling: invariants, secret scan, docs generator and checks, release |
| `.githooks/` | Git hooks (enabled by `pnpm install`) |
| `.github/workflows/` | CI |
| `CLAUDE.md` | Rules for AI assistants and a quick orientation |

## Scripts

<!-- GEN:app-scripts -->
| `pnpm <script>` (run in `app/`) | Runs |
|---|---|
| `dev` | `vite` |
| `build` | `tsc && vite build` |
| `preview` | `vite preview` |
| `tauri` | `tauri` |
| `dev:mcp` | `tauri dev --features mcp-bridge --config src-tauri/tauri.dev.conf.json` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `check` | `pnpm typecheck && pnpm lint && pnpm test` |
| `prepare` | `git config core.hooksPath .githooks` |
<!-- /GEN:app-scripts -->

Rust (run in `app/src-tauri`): `cargo fmt`, `cargo clippy --all-targets -- -D warnings`,
`cargo test`.

Repo checks (run from the repo root):

```powershell
node scripts/check-invariants.mjs        # compatibility invariants
node scripts/check-secrets.mjs --all     # secret scan of tracked files
node scripts/docs/generate.mjs           # refresh generated doc sections
node scripts/docs/check.mjs              # all docs checks
```

## Tests

- **Vitest** runs `app/src/**/*.test.ts(x)` with `TZ=Europe/London`, set in
  `app/vitest.config.ts`.
- **Billing characterization tests** (`app/src/utils/billing.characterization.test.ts`)
  pin today's exact money output. **Never update their snapshots** without an
  approved proposal (see [billing](billing.md)).

## Git hooks and CI

- `.githooks/pre-commit`: secret scan of staged files, invariants, docs
  generated/links checks, typecheck and lint.
- `.githooks/commit-msg`: docs freshness for the staged change (see
  [documentation](documentation.md)).
- `.githooks/pre-push`: unit tests and `cargo clippy`.
- CI runs all of the above plus `cargo fmt --check`, `cargo test`, a frontend
  build, dependency audits and gitleaks on every push and pull request.

## Claude Code

- **Docs Stop hook:** `.claude/settings.json` adds a Stop hook that runs the
  docs checks, so an AI session can't finish with the docs out of date. See
  [documentation](documentation.md).
- **Tauri MCP server:** `.mcp.json` registers the Tauri MCP server
  (`@hypothesi/tauri-mcp-server`, pinned). It lets Claude take screenshots,
  inspect the DOM and IPC traffic, and drive the running app.
  - It needs the app started with the bridge: `pnpm dev:mcp` (in `app/`).
  - That enables the Cargo feature `mcp-bridge` and merges
    `app/src-tauri/tauri.dev.conf.json`, which turns on `withGlobalTauri` and
    grants the bridge's permissions.
  - The bridge listens on `127.0.0.1` only (ports 9223–9322).
  - It never ships: it is an optional dependency, registered only under
    `cfg(all(debug_assertions, feature = "mcp-bridge"))` and absent from
    `tauri.conf.json`, which invariant `mcp-bridge-dev-only` enforces.
  - Claude Code asks you to approve the server the first time it loads the
    project.

## Locked dependency versions

<!-- GEN:versions -->
| Package | Kind | Locked version |
|---|---|---|
| `react` | npm | 19.3.0 |
| `typescript` | npm | 5.8.3 |
| `vite` | npm | 7.3.6 |
| `tailwindcss` | npm | 3.4.19 |
| `zustand` | npm | 5.0.15 |
| `zod` | npm | 4.6.5 |
| `react-hook-form` | npm | 7.89.0 |
| `date-fns` | npm | 4.4.0 |
| `@tauri-apps/api` | npm | 2.11.1 |
| `@tauri-apps/cli` | npm | 2.11.5 |
| `@tauri-apps/plugin-opener` | npm | 2.5.5 |
| `vitest` | npm | 5.0.2 |
| `eslint` | npm | 10.11.0 |
| `tauri` | crate | 2.11.6 |
| `tauri-build` | crate | 2.6.3 |
| `tauri-plugin-updater` | crate | 2.12.0 |
| `tauri-plugin-opener` | crate | 2.5.5 |
| `oauth2` | crate | 4.4.2 |
| `reqwest` | crate | 0.11.27, 0.12.28, 0.13.5 |
| `tokio` | crate | 1.53.1 |
<!-- /GEN:versions -->
