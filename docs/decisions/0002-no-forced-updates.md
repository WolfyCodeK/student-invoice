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
  version" check, reserved for security emergencies.
- Important fixes, such as billing corrections, are communicated to clients
  directly.

## Consequences

- There is very little maintenance cost for old versions.
- Users who never update keep old bugs, including v1.0.1's billing issues
  (bug audit B1–B3).
