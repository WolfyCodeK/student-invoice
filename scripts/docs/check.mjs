#!/usr/bin/env node
// Runs every docs check. Flags are passed through to freshness.mjs, e.g.
//   node scripts/docs/check.mjs --base origin/main   (CI)
//   node scripts/docs/check.mjs --worktree --hook    (Claude Code Stop hook)
//
// In --hook mode the Stop-hook JSON is read from stdin once. Any failure exits
// 2 (Claude Code blocks the stop and shows the report to Claude), except when
// the stop was already blocked once in this cycle (stop_hook_active), where it
// reports and exits 0 to avoid a loop.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const hook = args.includes('--hook')
let stopHookActive = false
if (hook) {
  try {
    stopHookActive = Boolean(JSON.parse(readFileSync(0, 'utf8') || '{}').stop_hook_active)
  } catch {
    stopHookActive = false
  }
}

const steps = [
  ['generate.mjs', ['--check']],
  ['links.mjs', []],
  ['freshness.mjs', args.filter((a) => a !== '--hook')],
]
let failed = false
for (const [script, stepArgs] of steps) {
  const r = spawnSync(process.execPath, [join(here, script), ...stepArgs], { stdio: ['ignore', 'inherit', 'inherit'] })
  if (r.status !== 0) failed = true
}

if (!failed) process.exit(0)
if (!hook) process.exit(1)
if (stopHookActive) {
  console.error('(docs checks still failing; not blocking again in this stop cycle)')
  process.exit(0)
}
process.exit(2)
