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
| CSS (gzip) | 12 KiB | CI |
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
  total to ~131 MB, but moves all drawing to the CPU. Users choose this with
  **Low memory mode** (below); GPU rendering stays the default.
- **Idle CPU is effectively zero:** no timers or polling run while the app
  sits idle. The exceptions: if the window was reloaded during Google
  sign-in, the store asks `gmail_status` once a second until that sign-in
  ends, at most 5 minutes ([Gmail](gmail.md#status-and-disconnect)); and a
  single timer fires once just after midnight to see whether a new
  half-term has started ([billing](billing.md#where-the-logic-lives)).

## Low memory mode

Settings → Performance → **Low memory mode** turns off WebView2's GPU
rendering, which saves roughly 40% of the app's memory. It is off by
default, because on high-resolution screens drawing on the CPU can make
scrolling and animations a little less smooth.

- **Why it needs a restart:** WebView2 reads its command-line arguments only
  when the window is created. So the window isn't created from
  `tauri.conf.json` (`"create": false`). Instead, `create_main_window` in
  `app/src-tauri/src/lib.rs` builds it from that same config at start-up, after
  reading the preference, and passes `preferences::browser_args`. The
  **Restart now** button calls `restart_app`, which uses Tauri's
  `request_restart`: the app exits through its normal shutdown (releasing the
  single-instance lock) before the new copy starts.
- **Saved choice vs running state:** `get_preferences` returns both
  `lowMemoryMode` (the saved choice, used at the next start) and
  `lowMemoryModeActive` (what the running window was started with, recorded
  at start-up). Settings shows "Currently on/off" from the running state,
  sets the switch from the saved choice, and offers **Restart now** while
  they differ, however often it is reopened.
- **One copy at a time:** WebView2 refuses a second window on the same
  profile with different arguments. So release builds use
  `tauri-plugin-single-instance`: opening the app again brings the running
  window to the front instead of starting a second copy (development builds
  skip it, so they can run beside the installed app). If WebView2 still fails
  to create the window, start-up stops instead of leaving an invisible
  process behind.
- **Default arguments are kept.** Setting custom WebView2 arguments replaces
  wry's defaults (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`),
  so `app/src-tauri/src/preferences.rs` always includes them.
- **Where it's stored:** `%LOCALAPPDATA%\com.isaac.student-invoice\preferences.json`
  (`preferences-dev.json` for development builds), e.g.
  `{"lowMemoryMode": true}`. It is a setting for this PC, so it is not part
  of exports or backups. A missing or unreadable file means the defaults. Unknown fields
  are ignored, so older and newer versions can share the file. It is written
  atomically (temporary file, then rename).
- **UI:** `app/src/features/settings/performance-group.tsx`.

## What keeps it small

- **Rust release profile** (`app/src-tauri/Cargo.toml`): `lto`,
  `codegen-units = 1`, `opt-level = "s"`, `strip`. The exe went from
  15.6 MB to 10.0 MB. Panics still unwind, so a failure in a background task
  can't take the whole app down.
- **One HTTP client for the app's own traffic:** Gmail and Google sign-in
  share one reqwest client using Windows' TLS. The old oauth2 4.x dependency,
  which pulled in a second, older stack, is gone. The updater plugin still
  brings its own rustls-based stack (and zip support it doesn't need). Trimming
  its features would save a few hundred KB, but it changes how installed
  copies download future updates, so it is left for a 1.1.x release with its
  own update test.
- **Code splitting** (`app/src/App.tsx`): these are loaded on first use:
  - Settings, and with it export/import and zod;
  - the family editor (react-hook-form, zod);
  - the feedback form (EmailJS);
  - What's new, "Choose how it looks" and the tour.
  The first three are prefetched when the app is idle
  (`requestIdleCallback` with a 1-second `timeout`, so a busy start-up can't
  put it off longer than that), so they still open instantly. Going to
  Settings or the editor is a React transition (`startTransition`) inside a
  `Suspense` boundary shared with the register, so the old screen stays on
  show until the new one is ready, even if its code is still loading: no
  blank moment ([UI](ui.md#structure)). The start-up bundle went from 187 KiB (v1.0.1)
  to 114 KiB gzipped.
- **No CSS framework:** the v1.1.0 redesign replaced Tailwind and the
  shadcn wrappers with plain CSS on design tokens (`app/src/styles/`). Screens
  loaded on demand bring their own small CSS files. The CSS budget went from
  10 to 12 KiB because the tokens carry four colour sets (two schemes, light
  and dark). The JavaScript saving more than pays for it.
- **Fonts are bundled, not fetched** (the CSP allows no font hosts). Only the
  Latin and Latin Extended subsets ship, about 190 KB in all. A face
  downloads only when it's used, so a normal start loads one 34 KB file, and
  the Navy and amber fonts (Nunito) load only with that scheme.
- **zod stays out of the start-up bundle:** constants the store needs live
  in `app/src/lib/schema/constants.ts`, and backup parsing is in its own module
  (`app/src/lib/backup-parse.ts`).
- **Modern build target** (`es2022`), because WebView2 is an evergreen
  Chromium.
- **Nothing slow on the main thread, no needless re-renders:**
  - Rust commands that read or write files run on Tauri's thread pool, so
    the daily backup's disk flush can't freeze the window.
  - Update downloads send at most one progress event per whole percent, and
    only the update dialog listens to them.
  - The register and title bar are memoised and read the store through
    selectors; a family's lessons and invoice are computed once per render.
  - Firing a toast doesn't re-render the component that fired it.
- **No artificial delay at start-up:** v1.0.1 showed a fixed 800 ms loading
  screen. The saved appearance (colour scheme, corners, light or dark) is now
  applied by a tiny inline script in `app/index.html` before the first paint.

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
   - "Usable" means the register is rendered: its grid, or the empty state
     when there are no families. It is detected through the WebView2 DevTools
     port, with nothing injected into the page.
3. **Errors and CSP:** while a build started with
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229` is
   running, `node scripts/perf/cdp-check.mjs` reports CSP violations,
   exceptions and console warnings.

## Results

| Measure | v1.0.1 code | Now (2026-09-26) |
|---|---|---|
| Installer (MSI) | 6.2 MB | 5.4 MB, before the release-profile tuning |
| Exe | 15.6 MB | 10.0 MB |
| Start-up JS (gzip) | 153 KiB (v1.0.1 build) | 114 KiB (2026-09-27) |
| CSS (gzip) | | 10.9 KiB in all, 7.6 KiB of it at start-up (2026-09-27) |
| Time to usable UI | at least 1.3 s (including the fixed 800 ms loader) | ~0.5 s, measured before the register redesign; re-measure before release |
| Idle memory (total) | ~225 MB | ~210 MB |
| Idle CPU | ~0 | ~0 |
