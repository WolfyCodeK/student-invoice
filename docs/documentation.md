# How these docs stay accurate

These docs aim to be the fastest way for a developer, or an LLM, to
understand the app without reading all the code. That only works if they
are always true, so accuracy is enforced by tooling rather than left to
good intentions.

## The four mechanisms

1. **Coverage map**: `docs/docs-map.json`.
   - Each doc lists the source files (globs) it describes.
   - Every source file must be covered by at least one doc. A new file that
     isn't mapped fails the check, so nothing can be added without a place
     in the docs.
   - Files not yet documented may only sit in `pendingCoverage`, which must
     be empty before a release.
2. **Freshness check**: `scripts/docs/freshness.mjs`.
   - When a change touches a covered file but not its doc, the check fails
     and names the doc.
   - Fix it by updating the doc, even just to confirm it's still accurate.
     If the change genuinely doesn't affect the doc, add a commit trailer
     with the reason:
     ```
     Docs-Skip: docs/architecture.md -- renamed a local variable only
     Docs-Skip: all -- formatting-only change
     ```
3. **Generated sections**: `scripts/docs/generate.mjs`.
   - Facts that can be read from code are generated, never typed:
     - the Tauri command list, cross-checked against the handler
       registration and the permission allowlist (the generator fails if
       `build.rs` has no command allowlist);
     - capabilities;
     - the compatibility invariants;
     - dependency versions;
     - performance budgets;
     - `package.json` scripts;
     - JSON schemas of stored data.
   - Each generated section sits between `<!-- GEN:name -->` markers. Run
     `node scripts/docs/generate.mjs` to refresh them; `--check` fails if any
     are stale.
4. **Link check**: `scripts/docs/links.mjs`.
   - Every relative link and every backticked repo path (like
     `app/src/stores/app-store.ts`) must exist, so renames can't leave dead
     references.
   - `docs/README.md` must link every doc.
   - Docs must not contain invisible control characters (for example a
     backspace from an escaping mistake), which silently corrupt paths.

## Where the checks run

| When | What runs |
|---|---|
| `git commit` (pre-commit hook) | generated sections `--check`, links, invariants, secret scan, typecheck, lint |
| `git commit` (commit-msg hook) | freshness for the staged files, honouring `Docs-Skip` trailers |
| Claude Code finishing a turn (Stop hook in `.claude/settings.json`) | all docs checks against uncommitted changes. It blocks Claude from finishing until the docs are updated (once per stop). |
| CI (`.github/workflows/ci.yml`) | everything above, over all commits in the push or pull request |
| Release script | everything above, plus an empty `pendingCoverage` |

## Writing docs

- **Keep it current:** describe what the code does now. Put plans in
  proposals or the audits, not in reference docs.
- **Records vs reference:**
  - `docs/audits/`, `docs/proposals/` and `docs/decisions/` are dated
    records, listed under `records` in the map and exempt from freshness.
  - Everything else is reference and must stay true.
- **Link, don't copy:** when a fact belongs to another page, link to it.
