#!/usr/bin/env node
// Release pipeline. See docs/release.md for the full procedure.
//
//   node scripts/release/release.mjs prepare <version>
//       Preflight checks, version bump, "Release v<version>" commit (local),
//       signed MSI build, latest.json. Artifacts go to release-artifacts/v<version>/.
//
//   node scripts/release/release.mjs rc <version> <n>
//       Upload the prepared artifacts to a GitHub PRE-release v<version>-rc.<n>
//       (not "latest", so installed apps don't see it) for update testing.
//
//   node scripts/release/release.mjs publish <version>
//       Push main + tag v<version>, create the GitHub release as a draft with
//       the CHANGELOG section as notes, verify assets, publish it as latest,
//       then verify what installed apps will download.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../lib/repo.mjs'
import {
  REPO, assetUrl, buildEnv, capture, changelogSection, compareSemver, die, isSemver, msiName, run, step, v101CompatError,
} from './lib.mjs'
import { UPDATER_ENDPOINT } from '../invariants.config.mjs'

const root = repoRoot()
const [cmd, version, rcNumber] = process.argv.slice(2)
if (!['prepare', 'rc', 'publish'].includes(cmd) || !version || !isSemver(version)) {
  die('usage: release.mjs prepare <x.y.z> | rc <x.y.z> <n> | publish <x.y.z>')
}
const tag = `v${version}`
const outDir = join(root, 'release-artifacts', tag)
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const writeJson = (p, obj) => writeFileSync(join(root, p), JSON.stringify(obj, null, 2) + '\n')

function changelogFor(v) {
  const section = changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), v)
  if (!section) die(`CHANGELOG.md has no "## [${v}]" section`)
  if (!section.summary) die(`CHANGELOG.md [${v}] needs a <!-- latest-json-summary: ... --> line`)
  const err = v101CompatError(v, section.summary)
  if (err) die(err)
  return section
}

// ---------------------------------------------------------------------------
if (cmd === 'prepare') {
  step('Preflight')
  if (capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }) !== 'main') die('Release from main only')
  if (capture('git', ['status', '--porcelain'], { cwd: root })) die('Working tree is not clean')
  run('git', ['fetch', 'origin', '--tags'], { cwd: root })
  if (capture('git', ['rev-list', '--count', 'HEAD..origin/main'], { cwd: root }) !== '0') die('Local main is behind origin/main')
  if (capture('git', ['tag', '-l', tag], { cwd: root })) die(`Tag ${tag} already exists locally`)
  if (capture('git', ['ls-remote', '--tags', 'origin', tag], { cwd: root })) die(`Tag ${tag} already exists on origin`)
  const current = readJson('app/package.json').version
  if (compareSemver(version, current) <= 0) die(`${version} is not greater than the current version ${current}`)
  changelogFor(version)
  capture('gh', ['auth', 'status'])

  step('Repo checks (invariants, secrets, docs incl. coverage, tests, lint, Rust)')
  run('node', ['scripts/check-invariants.mjs'], { cwd: root })
  run('node', ['scripts/check-secrets.mjs', '--all'], { cwd: root })
  run('node', ['scripts/docs/generate.mjs', '--check'], { cwd: root })
  run('node', ['scripts/docs/links.mjs'], { cwd: root })
  run('node', ['scripts/docs/freshness.mjs', '--map-only', '--release'], { cwd: root })
  run('pnpm', ['check'], { cwd: join(root, 'app') })
  run('cargo', ['fmt', '--check'], { cwd: join(root, 'app/src-tauri') })
  run('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings'], { cwd: join(root, 'app/src-tauri') })
  run('cargo', ['test'], { cwd: join(root, 'app/src-tauri') })

  step(`Bump version ${current} → ${version}`)
  const pkg = readJson('app/package.json')
  pkg.version = version
  writeJson('app/package.json', pkg)
  const conf = readJson('app/src-tauri/tauri.conf.json')
  conf.version = version
  writeJson('app/src-tauri/tauri.conf.json', conf)
  for (const [file, re] of [
    ['app/src-tauri/Cargo.toml', /(\[package\][\s\S]*?\nversion = ")[^"]+(")/],
    ['app/src-tauri/Cargo.lock', /(\[\[package\]\]\nname = "student-invoice-tauri"\nversion = ")[^"]+(")/],
  ]) {
    const text = readFileSync(join(root, file), 'utf8')
    if (!re.test(text)) die(`could not find the version in ${file}`)
    writeFileSync(join(root, file), text.replace(re, `$1${version}$2`))
  }
  run('node', ['scripts/check-invariants.mjs'], { cwd: root })
  run('node', ['scripts/docs/generate.mjs'], { cwd: root })

  step('Build signed MSI')
  run('pnpm', ['tauri', 'build'], { cwd: join(root, 'app'), env: buildEnv() })
  const bundleDir = join(root, 'app/src-tauri/target/release/bundle/msi')
  const built = readdirSync(bundleDir).find((f) => f.endsWith(`_${version}_x64_en-US.msi`))
  if (!built || !existsSync(join(bundleDir, `${built}.sig`))) die(`signed MSI for ${version} not found in ${bundleDir}`)

  step('Collect artifacts and write latest.json')
  mkdirSync(outDir, { recursive: true })
  copyFileSync(join(bundleDir, built), join(outDir, msiName(version)))
  copyFileSync(join(bundleDir, `${built}.sig`), join(outDir, `${msiName(version)}.sig`))
  const signature = readFileSync(join(outDir, `${msiName(version)}.sig`), 'utf8').trim()
  const { summary } = changelogFor(version)
  const platform = { signature, url: assetUrl(tag, msiName(version)) }
  const latest = {
    version,
    notes: summary,
    pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    // updater ≤2.9 (v1.0.1) reads only the generic key; newer updaters prefer the -msi key.
    platforms: { 'windows-x86_64': platform, 'windows-x86_64-msi': platform },
  }
  const err = v101CompatError(latest.version, latest.notes)
  if (err) die(err)
  writeFileSync(join(outDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')

  step('Commit the version bump (not pushed)')
  run('git', ['add', 'app/package.json', 'app/src-tauri/tauri.conf.json', 'app/src-tauri/Cargo.toml', 'app/src-tauri/Cargo.lock', 'docs'], { cwd: root })
  run('git', ['commit', '-m', `Release ${tag}`, '-m', 'Docs-Skip: all -- version bump only'], { cwd: root })
  console.log(`\n✔ Prepared ${tag} in ${outDir}. Next: rc ${version} 1 (update test), then publish ${version}.`)
}

// ---------------------------------------------------------------------------
function requireArtifacts() {
  for (const f of [msiName(version), `${msiName(version)}.sig`, 'latest.json']) {
    if (!existsSync(join(outDir, f))) die(`missing ${f} in ${outDir} — run prepare first`)
  }
}

if (cmd === 'rc') {
  if (!/^\d+$/.test(rcNumber ?? '')) die('usage: release.mjs rc <x.y.z> <n>')
  requireArtifacts()
  const rcTag = `${tag}-rc.${rcNumber}`
  step(`Upload artifacts to pre-release ${rcTag}`)
  // The RC's latest.json must point at the RC's asset URLs.
  const latest = JSON.parse(readFileSync(join(outDir, 'latest.json'), 'utf8'))
  for (const p of Object.values(latest.platforms)) p.url = assetUrl(rcTag, msiName(version))
  const rcDir = join(outDir, rcTag)
  mkdirSync(rcDir, { recursive: true })
  writeFileSync(join(rcDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')
  run('gh', ['release', 'create', rcTag, '--repo', REPO, '--prerelease', '--latest=false', '--target', capture('git', ['rev-parse', 'HEAD'], { cwd: root }),
    '--title', `Student Invoice ${version} (release candidate ${rcNumber})`, '--notes', 'Release candidate for update testing. Not offered to installed apps.',
    join(outDir, msiName(version)), join(outDir, `${msiName(version)}.sig`), join(rcDir, 'latest.json')])
  console.log(`\n✔ RC uploaded. Test latest.json: ${assetUrl(rcTag, 'latest.json')}`)
}

// ---------------------------------------------------------------------------
if (cmd === 'publish') {
  requireArtifacts()
  const { body } = changelogFor(version)
  if (capture('git', ['log', '-1', '--format=%s'], { cwd: root }) !== `Release ${tag}`) die(`HEAD is not the "Release ${tag}" commit`)
  step('Tag and push')
  run('git', ['tag', '-a', tag, '-m', `Student Invoice ${version}`], { cwd: root })
  run('git', ['push', 'origin', 'main', tag], { cwd: root })

  step('Create draft release with changelog notes')
  const notesFile = join(outDir, 'release-notes.md')
  writeFileSync(notesFile, body + '\n')
  run('gh', ['release', 'create', tag, '--repo', REPO, '--draft', '--title', `Student Invoice v${version}`, '--notes-file', notesFile,
    join(outDir, msiName(version)), join(outDir, `${msiName(version)}.sig`), join(outDir, 'latest.json')])
  const assets = JSON.parse(capture('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'assets'])).assets.map((a) => a.name)
  for (const f of [msiName(version), `${msiName(version)}.sig`, 'latest.json']) if (!assets.includes(f)) die(`draft release is missing ${f}`)

  step('Publish as latest')
  run('gh', ['release', 'edit', tag, '--repo', REPO, '--draft=false', '--latest'])

  step('Verify what installed apps will see')
  const live = await (await fetch(UPDATER_ENDPOINT, { redirect: 'follow' })).json()
  if (live.version !== version) die(`live latest.json reports ${live.version}, expected ${version}`)
  const err = v101CompatError(live.version, live.notes)
  if (err) die(`live latest.json: ${err}`)
  const head = await fetch(live.platforms['windows-x86_64'].url, { method: 'HEAD', redirect: 'follow' })
  if (!head.ok) die(`MSI URL returned HTTP ${head.status}`)
  console.log(`\n✔ Released ${tag}. Installed apps will now be offered ${version}.`)
}
