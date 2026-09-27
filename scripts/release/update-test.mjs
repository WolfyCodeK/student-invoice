#!/usr/bin/env node
// Local end-to-end test of the in-app updater, without publishing anything.
// Procedure: docs/release.md ("Local update test").
//
//   node scripts/release/update-test.mjs harness [<tag>]
//       Builds "<tag>-localtest" (default v1.0.1): the exact source of that
//       release, except that its updater looks at
//       http://127.0.0.1:8765/latest.json instead of GitHub.
//
//   node scripts/release/update-test.mjs target <version> [<minimum>]
//       Builds a signed MSI of the current checkout labelled <version> and a
//       latest.json pointing at the local server. The version bump is undone
//       afterwards; nothing is committed. With <minimum>, latest.json also
//       carries minimumSupportedVersion, to test the "important update" prompt.
//
//   node scripts/release/update-test.mjs serve
//       Serves the test files on http://127.0.0.1:8765 (Ctrl+C to stop).
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../lib/repo.mjs'
import { VERSION_FILES, buildEnv, bumpVersion, capture, checkMsiSignature, collectSignedMsi, die, findSignedMsi, isSemver, msiName, run, step } from './lib.mjs'

const root = repoRoot()
const outDir = join(root, 'release-artifacts', 'update-test')
const PORT = 8765
const base = `http://127.0.0.1:${PORT}`
const [cmd, version, minimum] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

if (cmd === 'harness') {
  const tag = version ?? 'v1.0.1'
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) die('usage: update-test.mjs harness [<tag, e.g. v1.1.0>]')
  const msiOut = join(outDir, `Student.Invoice_${tag.slice(1)}-localtest_x64_en-US.msi`)
  const wt = join(root, 'release-artifacts', `wt-${tag}`)
  step(`Check out ${tag} into a temporary worktree`)
  if (existsSync(wt)) rmSync(wt, { recursive: true, force: true, maxRetries: 3 })
  run('git', ['worktree', 'prune'], { cwd: root })
  run('git', ['worktree', 'add', '--detach', wt, tag], { cwd: root })
  try {
    // The source folder was renamed from student-invoice-tauri/ to app/ in v1.1.0.
    const app = join(wt, existsSync(join(wt, 'app')) ? 'app' : 'student-invoice-tauri')
    const confPath = join(app, 'src-tauri', 'tauri.conf.json')
    const conf = JSON.parse(readFileSync(confPath, 'utf8'))
    conf.plugins.updater.endpoints = [`${base}/latest.json`]
    conf.plugins.updater.dangerousInsecureTransportProtocol = true
    conf.bundle.targets = ['msi']
    conf.bundle.createUpdaterArtifacts = false // no signing key needed: it is installed by hand
    writeFileSync(confPath, JSON.stringify(conf, null, 2))
    step(`Build ${tag}-localtest (unsigned; it is installed by hand)`)
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: app, env: { ...process.env, CI: 'true' } })
    run('pnpm', ['tauri', 'build', '--bundles', 'msi'], { cwd: app })
    const bundle = join(app, 'src-tauri', 'target', 'release', 'bundle', 'msi')
    const msi = readdirSync(bundle).find((f) => f.endsWith('.msi'))
    copyFileSync(join(bundle, msi), msiOut)
    console.log(`\n✔ ${msiOut}`)
  } finally {
    // `git worktree remove` can fail on pnpm's node_modules links; delete the
    // folder ourselves, then let git forget the worktree.
    rmSync(wt, { recursive: true, force: true, maxRetries: 3 })
    run('git', ['worktree', 'prune'], { cwd: root })
  }
} else if (cmd === 'target') {
  if (!isSemver(version ?? '')) die('usage: update-test.mjs target <x.y.z> [<minimum x.y.z>]')
  if (capture('git', ['status', '--porcelain'], { cwd: root })) die('Working tree must be clean (the version bump is reverted with git checkout)')
  const env = await buildEnv()
  // Undo the bump however the script ends: `die` exits the process, which
  // skips `finally` blocks but still runs 'exit' listeners.
  process.once('exit', () => spawnSync('git', ['checkout', '--', ...VERSION_FILES], { cwd: root, stdio: 'inherit' }))
  process.once('SIGINT', () => process.exit(130)) // Ctrl+C: exit normally so the listener runs
  step(`Temporarily label the build ${version}`)
  bumpVersion(root, version)
  step('Build signed MSI')
  run('pnpm', ['tauri', 'build'], { cwd: join(root, 'app'), env })
  const msi = findSignedMsi(root, version)
  checkMsiSignature(msi)
  collectSignedMsi(msi, outDir, { version, notes: `Local update test ${version}`, url: `${base}/${msiName(version)}`, minimumSupportedVersion: minimum })
  console.log(`\n✔ ${msiName(version)} + latest.json in ${outDir}`)
} else if (cmd === 'serve') {
  createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\//, ''))
    const file = join(outDir, name)
    if (!name || name.includes('..') || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found')
      return console.log(`404 ${req.url}`)
    }
    console.log(`200 ${req.url}`)
    res.writeHead(200, { 'Content-Length': statSync(file).size, 'Content-Type': name.endsWith('.json') ? 'application/json' : 'application/octet-stream' })
    createReadStream(file).pipe(res)
  }).listen(PORT, '127.0.0.1', () => console.log(`Serving ${outDir} on ${base} (Ctrl+C to stop)`))
} else if (cmd === 'clean') {
  rmSync(outDir, { recursive: true, force: true })
} else {
  die('usage: update-test.mjs harness [<tag>] | target <x.y.z> [<minimum>] | serve | clean')
}
