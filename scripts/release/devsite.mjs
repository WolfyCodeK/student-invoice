// dev.wolfyk.com: the permanent home of the installers and the update feed
// (docs/release.md "dev.wolfyk.com"). On the site, everything under
// /releases/ is served from its own folder, apart from the site's pages, so
// the site's look can change without touching what installed copies read.
//
//   node scripts/release/devsite.mjs setup-key
//       Creates the upload key (once) in the secrets folder and prints its
//       public half, to install for the devsite-upload account on the server.
//
// Uploads use that account over SFTP, checked against the pinned host key in
// devsite-known-hosts. On the server the key can only use SFTP inside the
// releases folder, and can't delete or link anything.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { UPDATER_FEED } from '../invariants.config.mjs'
import { SECRETS_DIR, die, msiName, step, v101CompatError } from './lib.mjs'

const HOST = 'dev.wolfyk.com'
const USER = 'devsite-upload'
/** The app's folder on the server, relative to the releases folder the account starts in. */
const APP_DIR = 'student-invoice'
const here = dirname(fileURLToPath(import.meta.url))
const KNOWN_HOSTS = join(here, 'devsite-known-hosts')
const KEY = join(SECRETS_DIR, 'devsite-upload')

/** A version's file on the site, e.g. .../student-invoice/v1.1.2/Student.Invoice_1.1.2_x64_en-US.msi. */
export const devsiteUrl = (tag, name) => `${UPDATER_FEED.replace(/\/latest\.json$/, '')}/${tag}/${name}`

/** Where a release's dev.wolfyk.com latest.json is kept, next to its other artifacts. */
export const devsiteLatestPath = (outDir) => join(outDir, 'devsite', 'latest.json')

/**
 * Writes the dev.wolfyk.com copy of a release's latest.json: the same as the
 * GitHub one (release-artifacts/v<version>/latest.json), offering the
 * installer from dev.wolfyk.com instead.
 */
export function writeDevsiteLatest(outDir, version) {
  const latest = JSON.parse(readFileSync(join(outDir, 'latest.json'), 'utf8'))
  if (latest.version !== version) die(`${outDir}/latest.json is for ${latest.version}, not ${version}`)
  const url = devsiteUrl(`v${version}`, msiName(version))
  for (const platform of Object.values(latest.platforms)) platform.url = url
  const err = v101CompatError(latest.version, latest.notes)
  if (err) die(err)
  mkdirSync(join(outDir, 'devsite'), { recursive: true })
  writeFileSync(devsiteLatestPath(outDir), JSON.stringify(latest, null, 2) + '\n')
}

function sftp(commands) {
  if (!existsSync(KEY)) die(`no upload key at ${KEY}: run "node scripts/release/devsite.mjs setup-key" (docs/release.md)`)
  for (const path of [KEY, KNOWN_HOSTS]) if (/\s/.test(path)) die(`path has a space, which ssh can't take here: ${path}`)
  const work = mkdtempSync(join(tmpdir(), 'si-devsite-'))
  try {
    const batch = join(work, 'batch')
    writeFileSync(batch, commands.join('\n') + '\n')
    const r = spawnSync('sftp', [
      '-b', batch,
      '-i', KEY,
      '-o', 'IdentitiesOnly=yes',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes',
      '-o', `UserKnownHostsFile=${KNOWN_HOSTS}`,
      `${USER}@${HOST}`,
    ], { stdio: 'inherit' })
    if (r.status !== 0) die(`upload to ${HOST} failed (sftp exit ${r.status ?? r.error?.message})`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/** A local path as an sftp batch argument. */
const local = (path) => `"${path.replace(/\\/g, '/')}"`

/**
 * Uploads a release's installer and signature to dev.wolfyk.com. Nothing is
 * offered yet: installed copies only see a version once `offer` runs.
 */
export function uploadInstaller(outDir, version) {
  const tag = `v${version}`
  const msi = msiName(version)
  sftp([
    `-mkdir ${APP_DIR}`,
    `-mkdir ${APP_DIR}/${tag}`,
    `put ${local(join(outDir, msi))} ${APP_DIR}/${tag}/${msi}`,
    `put ${local(join(outDir, `${msi}.sig`))} ${APP_DIR}/${tag}/${msi}.sig`,
  ])
}

/**
 * Offers a release on dev.wolfyk.com: its latest.json goes up under another
 * name and is then renamed over the old one in one step, so installed copies
 * never read half a file.
 */
export function offer(outDir) {
  sftp([
    `put ${local(devsiteLatestPath(outDir))} ${APP_DIR}/latest.json.new`,
    `rename ${APP_DIR}/latest.json.new ${APP_DIR}/latest.json`,
  ])
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

async function download(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) die(`${url} returned HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Checks that dev.wolfyk.com serves exactly this release's installer and signature. */
export async function verifyInstaller(outDir, version) {
  const tag = `v${version}`
  const msi = msiName(version)
  if (sha256(await download(devsiteUrl(tag, msi))) !== sha256(readFileSync(join(outDir, msi)))) die(`${devsiteUrl(tag, msi)} doesn't match the local installer`)
  if ((await download(devsiteUrl(tag, `${msi}.sig`))).toString('utf8') !== readFileSync(join(outDir, `${msi}.sig`), 'utf8')) die(`${devsiteUrl(tag, `${msi}.sig`)} doesn't match`)
}

/** Checks that the feed installed copies read offers this release, exactly as prepared. */
export async function verifyFeed(outDir, version) {
  const live = JSON.parse((await download(UPDATER_FEED)).toString('utf8'))
  const expected = JSON.parse(readFileSync(devsiteLatestPath(outDir), 'utf8'))
  if (live.version !== version) die(`${UPDATER_FEED} reports ${live.version}, expected ${version}`)
  if (JSON.stringify(live) !== JSON.stringify(expected)) die(`${UPDATER_FEED} differs from ${devsiteLatestPath(outDir)}`)
  const err = v101CompatError(live.version, live.notes)
  if (err) die(`${UPDATER_FEED}: ${err}`)
}

/** The version dev.wolfyk.com offers now, or null if it offers none yet. */
export async function offeredVersion() {
  const res = await fetch(UPDATER_FEED, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) die(`${UPDATER_FEED} returned HTTP ${res.status}`)
  return (await res.json()).version
}

// ---------------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd] = process.argv.slice(2)
  if (cmd !== 'setup-key') die('usage: devsite.mjs setup-key')
  if (existsSync(KEY)) {
    step(`The upload key already exists (${KEY}). Its public half:`)
  } else {
    step(`Create the upload key in ${SECRETS_DIR}`)
    mkdirSync(SECRETS_DIR, { recursive: true })
    const r = spawnSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'student-invoice release upload', '-f', KEY, '-q'], { stdio: 'inherit' })
    if (r.status !== 0) die(`ssh-keygen failed (exit ${r.status ?? r.error?.message})`)
    step('Created. Install this public half for the devsite-upload account on the server (docs/release.md):')
  }
  // Only the public half is ever read here; it is safe to show.
  console.log(readFileSync(`${KEY}.pub`, 'utf8').trim())
}
