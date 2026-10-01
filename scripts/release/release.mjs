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
//       Upload the installer to dev.wolfyk.com, push main + tag v<version>,
//       create the GitHub release as a draft with the CHANGELOG section as
//       notes, verify assets, publish it as latest, offer it on dev.wolfyk.com,
//       then verify what installed apps will download from both feeds.
//
//   node scripts/release/release.mjs mirror <version>
//       Put an already published release on dev.wolfyk.com as well (the
//       version GitHub offers now; never an older one than the site offers).
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../lib/repo.mjs'
import {
  REPO, VERSION_FILES, assetUrl, buildEnv, bumpVersion, capture, changelogSection, checkMsiSignature, collectSignedMsi, compareSemver, die, findSignedMsi,
  isSemver, msiName, run, step, v101CompatError,
} from './lib.mjs'
import { GITHUB_UPDATER_FEED } from '../invariants.config.mjs'
import { offer, offeredVersion, uploadInstaller, verifyFeed, verifyInstaller, writeDevsiteLatest } from './devsite.mjs'
import { INSTALLER_BUDGET_MIB } from '../perf/budgets.mjs'

const root = repoRoot()
const [cmd, version, rcNumber] = process.argv.slice(2)
if (!['prepare', 'rc', 'publish', 'mirror'].includes(cmd) || !version || !isSemver(version)) {
  die('usage: release.mjs prepare <x.y.z> | rc <x.y.z> <n> | publish <x.y.z> | mirror <x.y.z>')
}
const tag = `v${version}`
const outDir = join(root, 'release-artifacts', tag)
/** The release assets, as named in outDir and on GitHub. */
const ASSETS = [msiName(version), `${msiName(version)}.sig`, 'latest.json']
const [MSI, SIG, LATEST] = ASSETS

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
  const current = JSON.parse(readFileSync(join(root, 'app/package.json'), 'utf8')).version
  if (compareSemver(version, current) <= 0) die(`${version} is not greater than the current version ${current}`)
  changelogFor(version)
  capture('gh', ['auth', 'status'])
  const env = await buildEnv()

  step('Repo checks (invariants, secrets, docs incl. coverage, tests, lint, Rust)')
  run('node', ['scripts/check-invariants.mjs'], { cwd: root })
  run('node', ['scripts/check-secrets.mjs', '--all'], { cwd: root })
  run('node', ['scripts/docs/generate.mjs', '--check'], { cwd: root })
  run('node', ['scripts/docs/links.mjs'], { cwd: root })
  run('node', ['scripts/docs/freshness.mjs', '--map-only', '--release'], { cwd: root })
  run('pnpm', ['check'], { cwd: join(root, 'app') })
  run('pnpm', ['build'], { cwd: join(root, 'app') })
  run('node', ['scripts/perf/check-bundle.mjs'], { cwd: root })
  run('cargo', ['fmt', '--check'], { cwd: join(root, 'app/src-tauri') })
  run('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings'], { cwd: join(root, 'app/src-tauri') })
  run('cargo', ['test'], { cwd: join(root, 'app/src-tauri') })

  step(`Bump version ${current} → ${version}`)
  bumpVersion(root, version)
  run('node', ['scripts/check-invariants.mjs'], { cwd: root })
  run('node', ['scripts/docs/generate.mjs'], { cwd: root })

  step('Build signed MSI')
  run('pnpm', ['tauri', 'build'], { cwd: join(root, 'app'), env })
  const msi = findSignedMsi(root, version)
  checkMsiSignature(msi)
  const msiMiB = statSync(msi).size / 1024 / 1024
  if (msiMiB > INSTALLER_BUDGET_MIB) die(`MSI is ${msiMiB.toFixed(2)} MiB, over the ${INSTALLER_BUDGET_MIB} MiB budget (docs/performance.md)`)
  console.log(`MSI size ${msiMiB.toFixed(2)} MiB (budget ${INSTALLER_BUDGET_MIB} MiB)`)

  step('Collect artifacts and write latest.json')
  const { summary, minimumSupportedVersion } = changelogFor(version)
  if (minimumSupportedVersion) console.log(`Versions below ${minimumSupportedVersion} will show this update as important.`)
  collectSignedMsi(msi, outDir, { version, notes: summary, url: assetUrl(tag, MSI), minimumSupportedVersion })
  writeDevsiteLatest(outDir, version)

  step('Commit the version bump (not pushed)')
  run('git', ['add', ...VERSION_FILES, 'docs'], { cwd: root })
  run('git', ['commit', '-m', `Release ${tag}`, '-m', 'Docs-Skip: all -- version bump only'], { cwd: root })
  console.log(`\n✔ Prepared ${tag} in ${outDir}. Next: rc ${version} 1 (update test), then publish ${version}.`)
}

// ---------------------------------------------------------------------------
function requireArtifacts() {
  for (const f of ASSETS) {
    if (!existsSync(join(outDir, f))) die(`missing ${f} in ${outDir} — run prepare first`)
  }
}

if (cmd === 'rc') {
  if (!/^\d+$/.test(rcNumber ?? '')) die('usage: release.mjs rc <x.y.z> <n>')
  requireArtifacts()
  const rcTag = `${tag}-rc.${rcNumber}`
  step(`Upload artifacts to pre-release ${rcTag}`)
  // The RC's latest.json must point at the RC's asset URLs.
  const latest = JSON.parse(readFileSync(join(outDir, LATEST), 'utf8'))
  for (const p of Object.values(latest.platforms)) p.url = assetUrl(rcTag, MSI)
  const rcDir = join(outDir, rcTag)
  mkdirSync(rcDir, { recursive: true })
  writeFileSync(join(rcDir, LATEST), JSON.stringify(latest, null, 2) + '\n')
  // The "Release vX" commit isn't pushed until publish, so GitHub doesn't know
  // it yet: tag the RC on main as GitHub has it. Only its assets are tested.
  run('gh', ['release', 'create', rcTag, '--repo', REPO, '--prerelease', '--latest=false', '--target', 'main',
    '--title', `Student Invoice ${version} (release candidate ${rcNumber})`, '--notes', 'Release candidate for update testing. Not offered to installed apps.',
    join(outDir, MSI), join(outDir, SIG), join(rcDir, LATEST)])
  console.log(`\n✔ RC uploaded. Test latest.json: ${assetUrl(rcTag, LATEST)}`)
}

// ---------------------------------------------------------------------------
if (cmd === 'publish') {
  requireArtifacts()
  const { body } = changelogFor(version)
  if (capture('git', ['log', '-1', '--format=%s'], { cwd: root }) !== `Release ${tag}`) die(`HEAD is not the "Release ${tag}" commit`)
  // Both feeds must offer every release (docs/compatibility.md, updater-endpoint).
  // The installer goes up first; the site offers it only after GitHub does.
  step('Upload the installer to dev.wolfyk.com (not offered yet)')
  writeDevsiteLatest(outDir, version)
  uploadInstaller(outDir, version)
  await verifyInstaller(outDir, version)

  step('Tag and push')
  run('git', ['tag', '-a', tag, '-m', `Student Invoice ${version}`], { cwd: root })
  run('git', ['push', 'origin', 'main', tag], { cwd: root })

  step('Create draft release with changelog notes')
  const notesFile = join(outDir, 'release-notes.md')
  writeFileSync(notesFile, body + '\n')
  run('gh', ['release', 'create', tag, '--repo', REPO, '--draft', '--title', `Student Invoice v${version}`, '--notes-file', notesFile,
    ...ASSETS.map((f) => join(outDir, f))])
  const assets = JSON.parse(capture('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'assets'])).assets.map((a) => a.name)
  for (const f of ASSETS) if (!assets.includes(f)) die(`draft release is missing ${f}`)

  step('Publish as latest')
  run('gh', ['release', 'edit', tag, '--repo', REPO, '--draft=false', '--latest'])

  step('Offer it on dev.wolfyk.com')
  offer(outDir)

  step('Verify what installed apps will see')
  await verifyGithubFeed()
  await verifyFeed(outDir, version)
  console.log(`\n✔ Released ${tag}. Installed apps will now be offered ${version}, from dev.wolfyk.com and from GitHub.`)
}

/**
 * The GitHub feed (v1.0.1 to v1.1.1 read only this) offers this release, and
 * its installer downloads. Once the repository is private nobody can read it
 * anonymously (copies from v1.1.2 use dev.wolfyk.com), so the release is then
 * checked through the signed-in `gh` instead: published, with all its assets.
 */
async function verifyGithubFeed() {
  if (capture('gh', ['repo', 'view', REPO, '--json', 'visibility', '--jq', '.visibility']) !== 'PUBLIC') {
    const release = JSON.parse(capture('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'isDraft,assets']))
    if (release.isDraft) die(`GitHub release ${tag} is still a draft`)
    const names = release.assets.map((a) => a.name)
    for (const f of ASSETS) if (!names.includes(f)) die(`GitHub release ${tag} is missing ${f}`)
    return
  }
  const live = await (await fetch(GITHUB_UPDATER_FEED, { redirect: 'follow' })).json()
  if (live.version !== version) die(`GitHub latest.json reports ${live.version}, expected ${version}`)
  const err = v101CompatError(live.version, live.notes)
  if (err) die(`GitHub latest.json: ${err}`)
  const head = await fetch(live.platforms['windows-x86_64'].url, { method: 'HEAD', redirect: 'follow' })
  if (!head.ok) die(`GitHub MSI URL returned HTTP ${head.status}`)
}

// ---------------------------------------------------------------------------
if (cmd === 'mirror') {
  requireArtifacts()
  step('Check what the feeds offer now')
  await verifyGithubFeed()
  const offered = await offeredVersion()
  if (offered && compareSemver(offered, version) > 0) die(`dev.wolfyk.com already offers ${offered}, newer than ${version}`)
  step(`Upload ${tag} to dev.wolfyk.com`)
  writeDevsiteLatest(outDir, version)
  uploadInstaller(outDir, version)
  await verifyInstaller(outDir, version)
  step('Offer it on dev.wolfyk.com')
  offer(outDir)
  await verifyFeed(outDir, version)
  console.log(`\n✔ dev.wolfyk.com now offers ${version}. Installed copies from v1.1.2 on update from there.`)
}
