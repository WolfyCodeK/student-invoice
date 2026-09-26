#!/usr/bin/env node
// Local end-to-end test of the in-app updater, without publishing anything.
// Procedure: docs/release.md ("Local update test").
//
//   node scripts/release/update-test.mjs harness
//       Builds "v1.0.1-localtest": the exact v1.0.1 source, except that its
//       updater looks at http://127.0.0.1:8765/latest.json instead of GitHub.
//
//   node scripts/release/update-test.mjs target <version>
//       Builds a signed MSI of the current checkout labelled <version> and a
//       latest.json pointing at the local server. The version bump is undone
//       afterwards; nothing is committed.
//
//   node scripts/release/update-test.mjs serve
//       Serves the test files on http://127.0.0.1:8765 (Ctrl+C to stop).
import { createServer } from 'node:http'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../lib/repo.mjs'
import { buildEnv, capture, die, isSemver, msiName, run, step, v101CompatError } from './lib.mjs'

const root = repoRoot()
const outDir = join(root, 'release-artifacts', 'update-test')
const PORT = 8765
const base = `http://127.0.0.1:${PORT}`
const [cmd, version] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

if (cmd === 'harness') {
  const wt = join(root, 'release-artifacts', 'wt-v1.0.1')
  step('Check out v1.0.1 into a temporary worktree')
  if (existsSync(wt)) run('git', ['worktree', 'remove', '--force', wt], { cwd: root })
  run('git', ['worktree', 'add', '--detach', wt, 'v1.0.1'], { cwd: root })
  try {
    const app = join(wt, 'student-invoice-tauri')
    const confPath = join(app, 'src-tauri', 'tauri.conf.json')
    const conf = JSON.parse(readFileSync(confPath, 'utf8'))
    conf.plugins.updater.endpoints = [`${base}/latest.json`]
    conf.plugins.updater.dangerousInsecureTransportProtocol = true
    conf.bundle.targets = ['msi']
    writeFileSync(confPath, JSON.stringify(conf, null, 2))
    step('Build v1.0.1-localtest (unsigned; it is installed by hand)')
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: app, env: { ...process.env, CI: 'true' } })
    run('pnpm', ['tauri', 'build', '--bundles', 'msi'], { cwd: app })
    const bundle = join(app, 'src-tauri', 'target', 'release', 'bundle', 'msi')
    const msi = readdirSync(bundle).find((f) => f.endsWith('.msi'))
    copyFileSync(join(bundle, msi), join(outDir, 'Student.Invoice_1.0.1-localtest_x64_en-US.msi'))
    console.log(`\n✔ ${join(outDir, 'Student.Invoice_1.0.1-localtest_x64_en-US.msi')}`)
  } finally {
    run('git', ['worktree', 'remove', '--force', wt], { cwd: root })
  }
} else if (cmd === 'target') {
  if (!isSemver(version ?? '')) die('usage: update-test.mjs target <x.y.z>')
  if (capture('git', ['status', '--porcelain'], { cwd: root })) die('Working tree must be clean (the version bump is reverted with git checkout)')
  const files = ['app/package.json', 'app/src-tauri/tauri.conf.json', 'app/src-tauri/Cargo.toml', 'app/src-tauri/Cargo.lock']
  try {
    step(`Temporarily label the build ${version}`)
    const pkg = JSON.parse(readFileSync(join(root, files[0]), 'utf8'))
    pkg.version = version
    writeFileSync(join(root, files[0]), JSON.stringify(pkg, null, 2) + '\n')
    const conf = JSON.parse(readFileSync(join(root, files[1]), 'utf8'))
    conf.version = version
    writeFileSync(join(root, files[1]), JSON.stringify(conf, null, 2) + '\n')
    for (const [file, re] of [[files[2], /(\[package\][\s\S]*?\nversion = ")[^"]+(")/], [files[3], /(\[\[package\]\]\nname = "student-invoice-tauri"\nversion = ")[^"]+(")/]]) {
      const t = readFileSync(join(root, file), 'utf8')
      writeFileSync(join(root, file), t.replace(re, `$1${version}$2`))
    }
    step('Build signed MSI')
    run('pnpm', ['tauri', 'build'], { cwd: join(root, 'app'), env: buildEnv() })
    const bundle = join(root, 'app/src-tauri/target/release/bundle/msi')
    const built = readdirSync(bundle).find((f) => f.endsWith(`_${version}_x64_en-US.msi`))
    if (!built) die('built MSI not found')
    copyFileSync(join(bundle, built), join(outDir, msiName(version)))
    copyFileSync(join(bundle, `${built}.sig`), join(outDir, `${msiName(version)}.sig`))
    const platform = { signature: readFileSync(join(outDir, `${msiName(version)}.sig`), 'utf8').trim(), url: `${base}/${msiName(version)}` }
    const latest = { version, notes: `Local update test ${version}`, pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), platforms: { 'windows-x86_64': platform, 'windows-x86_64-msi': platform } }
    const err = v101CompatError(latest.version, latest.notes)
    if (err) die(err)
    writeFileSync(join(outDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')
    console.log(`\n✔ ${msiName(version)} + latest.json in ${outDir}`)
  } finally {
    run('git', ['checkout', '--', ...files], { cwd: root })
  }
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
  die('usage: update-test.mjs harness | target <x.y.z> | serve | clean')
}
