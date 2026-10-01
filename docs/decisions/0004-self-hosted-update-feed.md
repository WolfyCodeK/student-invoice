# 0004: Installers and updates come from dev.wolfyk.com

**Date:** 2026-10-01. **Status:** accepted.

## Context

Up to v1.1.1, installed copies know one update feed: the latest GitHub
release's `latest.json`. That only works while the repository is public, and
the owner wants the source private and the software offered from his own
site, `dev.wolfyk.com`, a home for all his apps. The site's look will change
over time; how the apps install and update must not.

## Decision

- **A permanent hosting path.** Everything under
  `https://dev.wolfyk.com/releases/` is served from its own folder on the
  server, apart from the site's pages. For this app:
  - the feed: `https://dev.wolfyk.com/releases/student-invoice/latest.json`;
  - each version's files: `…/releases/student-invoice/v<x.y.z>/`
    (`Student.Invoice_<x.y.z>_x64_en-US.msi` and its `.sig`).

  Restyling or replacing the site never touches that path. The site's
  download buttons read `latest.json`, so they always offer the current
  installer.
- **v1.1.2 asks the new feed first,** with the GitHub feed after it as a
  fallback. The `updater-endpoint` invariant enforces that order (see
  [compatibility](../compatibility.md)).
- **Every release goes to both feeds** until the repository is private:
  `release.mjs publish` uploads the installer to dev.wolfyk.com first, then
  publishes on GitHub, then offers it on dev.wolfyk.com. v1.1.1, released
  before this, is put there with `release.mjs mirror`.
- **Uploads are narrow.** They use a dedicated `devsite-upload` account whose
  key can only use SFTP inside the releases folder and can't delete or link
  anything, checked against a pinned host key. Updates stay minisign-signed,
  so a tampered installer on the server would be refused by installed
  copies. The key lives in the secrets folder like the signing key.
- **The repository goes private only after** the main user has updated to
  v1.1.2 or later, since v1.0.1 to v1.1.1 know only the GitHub feed.

## Consequences

- The feed and version URLs can never change. A later version may drop the
  GitHub fallback, but never the dev.wolfyk.com feed.
- Once the repository is private, copies still on v1.0.1 to v1.1.1 can't
  update themselves; they need the installer from the site, run once by hand.
- Releases depend on the droplet being up. If it isn't, `publish` stops
  before anything is offered anywhere.
