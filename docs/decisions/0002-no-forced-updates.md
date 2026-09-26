# 0002: Updates are never forced, and old versions are not patched

**Date:** 2026-09-26. **Status:** accepted.

## Context

v1.0.1's update prompt is optional, and it has no remote kill switch.
`latest.json` serves a single "latest" release to every installed version, so
maintaining a separate 1.0.x line of fixes would not fit the updater.

## Decision

- Users choose when to update. Old versions keep working because we never
  break what they depend on (see [compatibility](../compatibility.md)).
- Fixes ship only in the newest version.
- v1.1.0 adds a more visible update prompt and a dormant "minimum supported
  version" check, reserved for security emergencies. When a release sets it
  (see [release](../release.md#emergency-mark-old-versions-as-unsupported)),
  older copies from v1.1.0 on open the update dialog at every start and call
  the update important, but "Not now" still works: it is a stronger prompt,
  never a lock-out. (Wired to the UI on 2026-09-27; until then the check was
  computed but not shown.)
- Important fixes, such as billing corrections, are communicated to clients
  directly.

## Consequences

- There is very little maintenance cost for old versions.
- Users who never update keep old bugs, including v1.0.1's billing issues
  (bug audit B1–B3).
