#!/usr/bin/env node
// Fails when code changes without the docs that describe it.
//
// docs/docs-map.json declares, for every doc, the source globs it covers. If a
// change touches a covered file but not the doc, the doc is "stale" for that
// change. The fix is to update the doc (even a one-line edit confirming it is
// still accurate) or, if the change genuinely doesn't affect it, record why
// with a commit trailer:
//
//   Docs-Skip: docs/architecture.md -- only renamed a local variable
//   Docs-Skip: all -- formatting-only change
//
// It also checks the map itself: every doc exists and is listed, every glob
// matches something, and every source file is covered by at least one doc
// (or is explicitly listed under "pendingCoverage", which must be empty
// before a release).
//
// Modes:
//   --staged --msg-file <path>   commit-msg hook (staged files + message trailers)
//   --base <git-ref>             CI: all commits in <ref>..HEAD
//   --worktree                   uncommitted changes (Claude Code Stop hook via check.mjs)
//   --map-only                   only validate the map (no change detection)
//   --release                    also fail if pendingCoverage is non-empty
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot, gitLines, readRepoFile, matchesAny, globToRegExp } from '../lib/repo.mjs'

const root = repoRoot()
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const value = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined)

const map = JSON.parse(readRepoFile('docs/docs-map.json'))
const docs = map.docs
const problems = []

// ---- 1. Validate the map --------------------------------------------------
const tracked = gitLines(['ls-files'], root)
const untracked = gitLines(['ls-files', '--others', '--exclude-standard'], root)
const allFiles = [...new Set([...tracked, ...untracked])].filter((f) => existsSync(join(root, f)))

for (const [doc, spec] of Object.entries(docs)) {
  if (!existsSync(join(root, doc))) problems.push(`docs-map lists ${doc} but it does not exist`)
  for (const g of spec.covers ?? []) {
    if (!allFiles.some((f) => globToRegExp(g).test(f))) problems.push(`${doc}: glob "${g}" matches no files (renamed or removed?)`)
  }
}
for (const f of allFiles) {
  if (/^docs\/.*\.md$/.test(f) && !docs[f] && !matchesAny(f, map.records ?? [])) {
    problems.push(`${f} is not listed in docs/docs-map.json (add it under "docs" or "records")`)
  }
}
const sources = allFiles.filter((f) => matchesAny(f, map.sources) && !matchesAny(f, map.ignore ?? []))
const coveredBy = (f) => Object.entries(docs).filter(([, s]) => matchesAny(f, s.covers ?? [])).map(([d]) => d)
const pending = new Set(map.pendingCoverage ?? [])
for (const f of sources) {
  const covered = coveredBy(f).length > 0
  if (!covered && !pending.has(f)) problems.push(`${f} is not covered by any doc (add a glob to docs/docs-map.json)`)
  if (covered && pending.has(f)) problems.push(`${f} is covered now; remove it from pendingCoverage`)
}
for (const f of pending) if (!sources.includes(f)) problems.push(`pendingCoverage lists ${f}, which is not a source file`)
if (flag('--release') && pending.size) problems.push(`pendingCoverage must be empty for a release (${pending.size} file(s) undocumented)`)

// ---- 2. Detect stale docs for a change ------------------------------------
function trailers(message) {
  const skips = new Map()
  for (const m of message.matchAll(/^Docs-Skip:\s*(\S+)\s*--\s*(.+)$/gim)) skips.set(m[1], m[2].trim())
  return skips
}

let changed = null
let skips = new Map()
if (flag('--staged')) {
  changed = gitLines(['diff', '--cached', '--name-only'], root)
  const msgFile = value('--msg-file')
  if (msgFile) skips = trailers(readFileSync(msgFile, 'utf8'))
} else if (value('--base')) {
  const base = value('--base')
  changed = gitLines(['diff', '--name-only', `${base}...HEAD`], root)
  skips = trailers(gitLines(['log', '--format=%B', `${base}..HEAD`], root).join('\n'))
} else if (flag('--worktree')) {
  changed = [...gitLines(['diff', '--name-only', 'HEAD'], root), ...untracked]
}

const stale = []
if (changed) {
  const changedSet = new Set(changed)
  for (const [doc, spec] of Object.entries(docs)) {
    const hits = changed.filter((f) => matchesAny(f, spec.covers ?? []) && !matchesAny(f, map.ignore ?? []))
    if (!hits.length || changedSet.has(doc)) continue
    if (skips.has(doc) || skips.has('all')) continue
    stale.push({ doc, hits })
  }
}

// ---- Report ---------------------------------------------------------------
if (!problems.length && !stale.length) {
  console.log(`docs/freshness: ok${changed ? ` (${changed.length} changed file(s) checked)` : ''}`)
  process.exit(0)
}

const lines = []
if (problems.length) lines.push('Docs map problems:', ...problems.map((p) => '  - ' + p))
if (stale.length) {
  lines.push('Docs not updated for this change:')
  for (const s of stale) lines.push(`  - ${s.doc} (covers ${s.hits.slice(0, 5).join(', ')}${s.hits.length > 5 ? ', ...' : ''})`)
  lines.push('', 'Update each doc so it stays accurate, or add a commit trailer explaining why it is unaffected:', '  Docs-Skip: <doc path|all> -- <reason>')
}
console.error(lines.join('\n'))
process.exit(1)
