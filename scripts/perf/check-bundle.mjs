#!/usr/bin/env node
// Fails when the built frontend (app/dist, from `pnpm build`) exceeds the
// budgets in scripts/perf/budgets.mjs. Run in CI after the frontend build.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { repoRoot } from '../lib/repo.mjs'
import { BUNDLE_BUDGETS } from './budgets.mjs'

const dist = join(repoRoot(), 'app', 'dist')
if (!existsSync(join(dist, 'index.html'))) {
  console.error('app/dist not found: run `pnpm build` in app/ first')
  process.exit(1)
}
const kib = (bytes) => bytes / 1024
const gz = (file) => gzipSync(readFileSync(join(dist, 'assets', file))).length
const assets = readdirSync(join(dist, 'assets'))
const entry = readFileSync(join(dist, 'index.html'), 'utf8').match(/<script[^>]+src="\/assets\/([^"]+\.js)"/)?.[1]
if (!entry) {
  console.error('could not find the entry script in app/dist/index.html')
  process.exit(1)
}

const measured = {
  startupJsGzipKiB: kib(gz(entry)),
  totalJsGzipKiB: kib(assets.filter((f) => f.endsWith('.js')).reduce((s, f) => s + gz(f), 0)),
  cssGzipKiB: kib(assets.filter((f) => f.endsWith('.css')).reduce((s, f) => s + gz(f), 0)),
}

let failed = false
for (const [key, budget] of Object.entries(BUNDLE_BUDGETS)) {
  const value = measured[key]
  const ok = value <= budget
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'OVER'} ${key.padEnd(18)} ${value.toFixed(1).padStart(7)} KiB  (budget ${budget} KiB)`)
}
if (failed) {
  console.error('\nBundle budget exceeded. Split the new code out (lazy import) or justify raising the budget in scripts/perf/budgets.mjs.')
  process.exit(1)
}
