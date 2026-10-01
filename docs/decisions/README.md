# Decision records

Short, dated records of decisions that shape the codebase and would otherwise
be re-litigated. They are historical: when a decision is reversed, add a new
record that supersedes the old one rather than editing it.

| # | Decision | Date |
|---|---|---|
| [0001](0001-additive-persisted-schema.md) | Persisted data stays at zustand version 0 and only changes additively | 2026-09-26 |
| [0002](0002-no-forced-updates.md) | Updates are never forced, and old versions are not patched | 2026-09-26 |
| [0003](0003-bundled-google-oauth-client.md) | The Google OAuth Desktop client is compiled into release builds | 2026-09-26 |
| [0004](0004-self-hosted-update-feed.md) | Installers and updates come from dev.wolfyk.com | 2026-10-01 |
