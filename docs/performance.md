# Performance

Student Invoice should be light on users' PCs: small to download, quick to
start, and quiet when idle. Tauri makes that possible, because the app is a
small native binary using the WebView2 already built into Windows, rather
than shipping its own browser the way Electron does. The budgets below keep
it that way.

## Budgets

<!-- GEN:performance-budgets -->
| Budget | Limit | Enforced by |
|---|---|---|
| Start-up JS (gzip) | 150 KiB | CI (`scripts/perf/check-bundle.mjs`) |
| All JS (gzip) | 210 KiB | CI |
| CSS (gzip) | 10 KiB | CI |
| MSI installer | 6 MiB | release script |
| Time to usable UI | 800 ms | `scripts/perf/measure.ps1` (manual) |
| Idle CPU | 0.1 CPU-s per 10 s | `scripts/perf/measure.ps1` (manual) |
<!-- /GEN:performance-budgets -->

Budgets live in `scripts/perf/budgets.mjs`. Raise one only on purpose, with
the reason in the commit message.

## Where the memory goes

Measured 2026-09-26 on the owner's PC, release build, idle on the main
screen:

| Process | Private memory |
|---|---|
| The app itself (Rust) | ~8 MB |
| The page (WebView2 renderer: our UI) | ~34 MB |
| WebView2 browser process | ~37 MB |
| WebView2 utility processes | ~19 MB |
| **WebView2 GPU process** | **~126 MB** |
| **Total** | **~210 MB** |

- **The GPU process is WebView2's own fixed overhead on this machine.**
  Removing every blur, gradient and shadow in the page made no difference.
- **Disabling GPU rendering** (the WebView2 argument `--disable-gpu`) cuts the
  total to ~131 MB, but moves all drawing to the CPU. That trade-off is an
  open decision; see the bug audit and CHANGELOG when it's made.
- **Idle CPU is effectively zero:** no timers or polling run while the app
  sits idle.

## What keeps it small

- **Rust release profile** (`app/src-tauri/Cargo.toml`): `lto`,
  `codegen-units = 1`, `opt-level = "s"`, `strip`. The exe went from
  15.6 MB to 10.0 MB. Panics still unwind, so a failure in a background task
  can't take the whole app down.
- **One HTTP stack:** everything, including OAuth, uses the app's reqwest
  client. The old oauth2 4.x dependency, which pulled in a second, older
  stack, is gone.
- **Code splitting** (`app/src/App.tsx`): Settings (and with it export/import
  and zod), the template form (react-hook-form, zod) and the feedback form
  (EmailJS) are loaded on first use. They are prefetched when the app is
  idle, so they still open instantly. The start-up bundle went from 187 KiB to
  141 KiB gzipped.
- **zod stays out of the start-up bundle:** constants the store needs live
  in `app/src/lib/schema/constants.ts`, and backup parsing is in its own module
  (`app/src/lib/backup-parse.ts`).
- **Modern build target** (`es2022`), because WebView2 is an evergreen
  Chromium.
- **No artificial delay at start-up:** v1.0.1 showed a fixed 800 ms loading
  screen. The saved light/dark theme is now applied by a tiny inline script in
  `app/index.html` before the first paint.

## Measuring

1. **Bundle:** after `pnpm build` in `app/`, run
   `node scripts/perf/check-bundle.mjs`. CI runs this on every push.
2. **Start-up, memory and idle CPU:**
   ```powershell
   cd app
   pnpm tauri build --no-bundle --config ../scripts/perf/perftest.conf.json
   cd ..
   powershell -File scripts/perf/measure.ps1 -Runs 3
   ```
   - The perftest config gives the build its own identifier, so it never
     reads or upgrades real user data.
   - "Usable" means the main screen is rendered. It is detected through the
     WebView2 DevTools port, with nothing injected into the page.
3. **Errors and CSP:** while a build started with
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229` is
   running, `node scripts/perf/cdp-check.mjs` reports CSP violations,
   exceptions and console warnings.

## Results

| Measure | v1.0.1 code | Now (2026-09-26) |
|---|---|---|
| Installer (MSI) | 6.2 MB | 5.4 MB, before the release-profile tuning |
| Exe | 15.6 MB | 10.0 MB |
| Start-up JS (gzip) | 153 KiB (v1.0.1 build) | 137 KiB |
| Time to usable UI | at least 1.3 s (including the fixed 800 ms loader) | ~0.5 s |
| Idle memory (total) | ~225 MB | ~210 MB |
| Idle CPU | ~0 | ~0 |
