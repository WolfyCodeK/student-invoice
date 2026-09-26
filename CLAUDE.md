# Student Invoice — guide for AI assistants

Windows desktop app (Tauri v2 + React/TypeScript + Rust) that turns
per-student templates into half-term invoice emails (clipboard or Gmail
draft). Installed copies update themselves from GitHub releases.

**Start with `docs/README.md`.** The docs are kept accurate by tooling and are
the intended way to understand the codebase without re-reading all of it.

## Hard rules

1. **Money logic needs the owner's approval.** Do not change anything that
   affects lesson counts, term dates, totals, costs or the dates quoted on an
   invoice (`app/src/utils/terms.ts`, `app/src/utils/invoice-generator.ts`)
   without a proposal in `docs/proposals/` that the owner has approved. Never
   update the billing characterization snapshots to make a test pass.
2. **Never break installed copies.** Respect every invariant in
   `docs/compatibility.md`, enforced by `node scripts/check-invariants.mjs`. In
   particular:
   - persisted data changes are additive only (`docs/data-model.md`);
   - `latest.json` notes are one plain line;
   - never rotate the updater key.
3. **Secrets never enter the repo, logs, command lines or chat.** They live in
   `%USERPROFILE%\.secrets\student-invoice\`. Don't read that folder. Scripts
   read secrets in-process only.
4. **Docs change with code.** Every source file is mapped to the doc(s) that
   describe it in `docs/docs-map.json`. When you change code, update those
   docs in the same change. Generated sections are refreshed with
   `node scripts/docs/generate.mjs`. A Stop hook runs the docs checks before
   you finish. Use a `Docs-Skip: <doc> -- <reason>` commit trailer only when a
   doc is genuinely unaffected.
5. **Commits belong to the owner.** Commit as the configured git user
   (WolfyCodeK) only. Never add `Co-Authored-By` or any other AI attribution
   to commit messages or pull request descriptions.

## Commands

| Task | Command |
|---|---|
| Install / enable hooks | `cd app && pnpm install` |
| Run the app | `cd app && pnpm tauri dev` |
| Frontend checks | `cd app && pnpm check` (typecheck, lint, tests) |
| Rust checks | `cd app/src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` |
| Repo checks | `node scripts/check-invariants.mjs`, `node scripts/check-secrets.mjs --all`, `node scripts/docs/check.mjs`, `node --test "scripts/**/*.test.mjs"` |
| Release | see `docs/release.md` |

## Layout

- `app/src`: React UI, zustand store and pure billing logic.
- `app/src-tauri`: Rust, Tauri config, capabilities.
- `docs`: reference docs plus dated records (`docs/audits`, `docs/proposals`).
- `scripts`: invariants, secret scan, docs tooling, release tooling.
- `CHANGELOG.md`: user-facing changes. Add an entry under `[Unreleased]` for
  anything a user would notice.
