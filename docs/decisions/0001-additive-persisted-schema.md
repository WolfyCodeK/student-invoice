# 0001: Persisted data stays at zustand version 0 and only changes additively

**Date:** 2026-09-26. **Status:** accepted.

## Context

All user data is one zustand-persisted localStorage entry,
`student-invoice-store`, and v1.0.1 has no `version` or `migrate` configured.
In zustand 5.0.8, a stored version that differs from the configured one, with
no migration, is dropped: the app loads defaults, and its next write
overwrites the stored data. v1.0.1 also only writes four top-level keys, so it
drops anything else at the top level.

## Decision

- Never bump the persist version.
- Only ever add optional fields, and put them inside `settings` or inside
  template objects.
- Handle migration and normalisation in a custom `merge` step that runs on
  every load and is idempotent.

## Consequences

- A user can install an older MSI over a newer one and keep their data.
- New data lives in slightly awkward places (nested in `settings`), and old
  fields can never be removed from the stored shape, only ignored.
