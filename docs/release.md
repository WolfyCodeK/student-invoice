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
| `google-oauth-client.json` | Google OAuth Desktop client, as downloaded from Google Cloud. Embedded into the build; the release refuses to build without it | Bitwarden |

The signing key's **password is not stored in a file**. It lives only in
Bitwarden, in the same item as `myapp.key`, and the scripts ask for it (see
[the signing key password](#the-signing-key-password)).

You also need the GitHub CLI signed in (`gh auth login`) with push rights.

## Procedure

1. **Write the changelog.** Rename `## [Unreleased]` in `CHANGELOG.md` to
   `## [x.y.z] - YYYY-MM-DD`, add a fresh `## [Unreleased]` above it, and add a
   `<!-- latest-json-summary: ... -->` line. The summary must be one plain line
   (see [compatibility](compatibility.md#the-latestjson-notes-rule)). Commit
   and push.
2. **Prepare:** `node scripts/release/release.mjs prepare x.y.z`, run by
   the owner in a terminal, because it asks for the signing key password.
   - Preflight:
     - on `main`, clean tree, up to date with `origin/main`;
     - the tag is not already taken, locally or on GitHub;
     - the new version is greater than the current one;
     - the changelog section and summary are present;
     - `gh` is signed in;
     - the signing key password, asked for and checked at once, before the
       long checks.
   - Runs every check: invariants, secret scan, docs, and `pnpm check`,
     `cargo fmt/clippy/test`.
   - Bumps the version in `app/package.json`, `tauri.conf.json`, `Cargo.toml`
     and `Cargo.lock` (all four are checked before any is written, so a
     failed bump changes nothing), and regenerates the docs.
   - Builds the signed MSI (the key and password are passed to Tauri as
     environment variables, never as arguments), checks that the `.sig` is a
     valid signature of exactly that MSI by the updater key (a stale `.sig`
     from an earlier build would make every installed copy reject the
     update), and copies both to `release-artifacts/vx.y.z/` (git-ignored).
   - Checks the bundle and the MSI against the size budgets
     ([performance](performance.md)).
   - Writes `latest.json` and checks that v1.0.1 can parse it.
   - Commits `Release vx.y.z` locally. Nothing is pushed yet.
3. **Release-candidate test:** `node scripts/release/release.mjs rc x.y.z 1`
   uploads the same artifacts to a GitHub **pre-release** `vx.y.z-rc.1`.
   Its tag points at `main` as GitHub has it, because the local "Release"
   commit isn't pushed until publish; only the assets matter for the test.
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
   updater asks `http://127.0.0.1:8765/latest.json` instead of GitHub. Pass a
   tag (`harness v1.1.0`) to build that release instead, for example to test
   updating from 1.1.0 once it exists.
2. **Build the target:** `node scripts/release/update-test.mjs target 1.1.0`
   builds a signed MSI of the current checkout labelled 1.1.0, plus a
   `latest.json` for the local server. It asks for the signing key password
   first. The version bump is reverted afterwards, even if the build fails or
   is stopped with Ctrl+C, and nothing is committed. Add a minimum version
   (`target 1.1.1 1.1.1`) to put `minimumSupportedVersion` in `latest.json`
   and check the "important update" prompt; this needs a harness from v1.1.0
   or later, since v1.0.1 doesn't know the field.
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

## The signing key password

`myapp.key` is stored encrypted with a password. Signing needs both. The
password only protects copies of the key file, so it is never written to disk
next to the key.

- **When it's asked for:** `release.mjs prepare` and `update-test.mjs target`
  ask for it in the terminal (hidden) before they start, and check it straight
  away against the updater public key in `scripts/invariants.config.mjs`. It
  reaches `tauri build` only through the `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  environment variable. These steps therefore can't run through a tool
  without a terminal, such as an AI assistant.
- **Changing it:** `node scripts/release/change-key-password.mjs`, run by the
  owner in a terminal.
  1. Generate the new password in Bitwarden and save it in the `myapp.key`
     item first.
  2. The script asks for the current password and the new one (twice; at
     least 16 characters), then re-encrypts the **same** key. The public key,
     which installed copies trust, doesn't change, so this is not a key
     rotation (see [compatibility](compatibility.md)).
  3. Before switching, it checks the result: Tauri's own signer must sign a
     test file with the new key file and password, and the signature must
     verify against the updater public key. If anything fails, nothing is
     changed.
  4. It keeps the previous file as `myapp.key.old`. Replace the key in
     Bitwarden, then delete `myapp.key.old` and any other old copies, since
     those still open with the old password.
- **How it works:** `scripts/release/signing-key.mjs` implements the minisign
  secret-key format as the `minisign` crate that Tauri's signer uses: scrypt,
  then XOR over the key id, key and checksum. Its tests are in
  `scripts/release/signing-key.test.mjs`. On 2026-09-26 it was also checked on
  a throwaway key against `tauri signer sign` (which rejects the old password
  and accepts the new one) and against `minisign-verify` 0.2.5, the verifier
  the updater uses.

## Emergency: mark old versions as unsupported

Only for a security problem that makes older versions unsafe to keep using
([decision 0002](decisions/0002-no-forced-updates.md)).

1. In the fixed version's changelog section, next to the summary line, add
   `<!-- minimum-supported-version: x.y.z -->`, where `x.y.z` is the oldest
   version that is still safe (at most the version being released).
2. Release as usual. `release.mjs prepare` copies it into `latest.json` as
   `minimumSupportedVersion` and checks it is a plain `x.y.z` no higher than
   the release.
3. Installed copies from v1.1.0 on that are older than `x.y.z` open the
   update dialog at every start, saying it's an important update. "Not now"
   still works: nothing is forced, and nothing else changes. v1.0.1 ignores
   the field and shows its normal update prompt.
4. Tell users directly as well; the prompt only reaches people who open the
   app.

Leave the line out of the next release's section once users have moved on;
each `latest.json` only carries what its own section says.

## If something goes wrong after publishing

- `gh release edit v<previous> --latest` makes the previous release *latest*
  again, so no more installs pick up the bad version.
- Fix forward with a higher version number; the updater never downgrades.
- Never delete old releases or their assets.
