# Releasing a new version

Releases are built on the owner's Windows PC with
`scripts/release/release.mjs` and published as GitHub releases. Installed
apps find them through `latest.json`, a release asset (see
[compatibility](compatibility.md)).

## One-time setup

The secrets folder `%USERPROFILE%\.secrets\student-invoice\` must contain:

| File | Contents | Backup |
|---|---|---|
| `myapp.key` | Updater signing private key (minisign ID `8A406F2CA93B6BCC`) | Bitwarden |
| `signing-key-password.txt` | The key's password, on a single line | Bitwarden |
| `google-oauth-client.json` | Google OAuth Desktop client, as downloaded from Google Cloud. Embedded into the build; the release refuses to build without it | Bitwarden |

You also need the GitHub CLI signed in (`gh auth login`) with push rights.

## Procedure

1. **Write the changelog.** Rename `## [Unreleased]` in `CHANGELOG.md` to
   `## [x.y.z] - YYYY-MM-DD`, add a fresh `## [Unreleased]` above it, and add a
   `<!-- latest-json-summary: ... -->` line. The summary must be one plain line
   (see [compatibility](compatibility.md#the-latestjson-notes-rule)). Commit
   and push.
2. **Prepare:** `node scripts/release/release.mjs prepare x.y.z`
   - Preflight:
     - on `main`, clean tree, up to date with `origin/main`;
     - the tag is not already taken, locally or on GitHub;
     - the new version is greater than the current one;
     - the changelog section and summary are present;
     - `gh` is signed in.
   - Runs every check: invariants, secret scan, docs, and `pnpm check`,
     `cargo fmt/clippy/test`.
   - Bumps the version in `app/package.json`, `tauri.conf.json`, `Cargo.toml`
     and `Cargo.lock`, and regenerates the docs.
   - Builds the signed MSI (the key and password are passed to Tauri as
     environment variables, never as arguments) and copies it and its `.sig`
     to `release-artifacts/vx.y.z/` (git-ignored).
   - Writes `latest.json` and checks that v1.0.1 can parse it.
   - Commits `Release vx.y.z` locally. Nothing is pushed yet.
3. **Release-candidate test:** `node scripts/release/release.mjs rc x.y.z 1`
   uploads the same artifacts to a GitHub **pre-release** `vx.y.z-rc.1`.
   Pre-releases are never offered to installed apps. Run the upgrade test
   below against it.
4. **Publish:** `node scripts/release/release.mjs publish x.y.z`
   - Tags and pushes.
   - Creates a **draft** release with the changelog section as notes.
   - Checks all three assets are attached, then publishes it as *latest*.
   - Fetches the live `latest.json` and MSI URL to confirm what installed apps
     will see.

## Upgrade test (before publishing)

The MSI installs per-machine, so a second Windows account isolates data but
not the installed app.

1. **Back up first:** back up `%LOCALAPPDATA%\com.isaac.student-invoice`.
2. **Install the previous release** in a test Windows account and create
   realistic data:
   - templates for every weekday;
   - names containing `'`, `"`, `$&`, `£` and emoji;
   - a custom email body and dark theme.
3. **Update:**
   - To test the updater itself, use a build of the old version whose
     endpoint points at the RC's `latest.json`.
   - Otherwise, run the RC MSI over the old install. This is the same
     `msiexec` the updater runs.
4. **Check the result:** the new version starts, all data is identical, and
   there is exactly one entry in *Installed apps*.
5. **Downgrade check:** reinstall the old MSI; the data must still load.

## Local update test (no publishing)

`scripts/release/update-test.mjs` exercises the real v1.0.1 updater code
against a build of the current checkout, entirely on this PC.

1. **Build the harness:** `node scripts/release/update-test.mjs harness`
   builds *v1.0.1-localtest*. This is the exact v1.0.1 source, except that its
   updater asks `http://127.0.0.1:8765/latest.json` instead of GitHub.
2. **Build the target:** `node scripts/release/update-test.mjs target 1.1.0`
   builds a signed MSI of the current checkout labelled 1.1.0, plus a
   `latest.json` for the local server. The version bump is reverted
   afterwards and nothing is committed.
3. **Serve:** `node scripts/release/update-test.mjs serve`, and leave it
   running.
4. **Install the harness:**
   - Back up `%LOCALAPPDATA%\com.isaac.student-invoice` first.
   - Install `release-artifacts/update-test/Student.Invoice_1.0.1-localtest_x64_en-US.msi`.
   - Open the app. It reports version 1.0.1, and the Updates button shows the
     update.
5. **Update:** click **Updates → Install Update**, accept the UAC prompt, and
   wait for the app to restart.
6. **Check:** the app now reports the new version, all templates and settings
   are intact, and *Installed apps* lists a single "Student Invoice".
7. **Restore:** reinstall the real release MSI (for example
   `Student.Invoice_1.0.1_x64_en-US.msi` from GitHub). The harness updater
   only looks at `127.0.0.1`, so leaving it installed would cut this PC off
   from real updates. Then run `update-test.mjs clean`.

## If something goes wrong after publishing

- `gh release edit v<previous> --latest` makes the previous release *latest*
  again, so no more installs pick up the bad version.
- Fix forward with a higher version number; the updater never downgrades.
- Never delete old releases or their assets.
