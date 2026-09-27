// Shared helpers for the release scripts. Node built-ins only.
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { EOL, homedir } from 'node:os'
import { join } from 'node:path'
import { LATEST_JSON_NOTES_PATTERN } from '../invariants.config.mjs'
import { unlock, verifySignature } from './signing-key.mjs'

export const REPO = 'WolfyCodeK/student-invoice'
export const SECRETS_DIR = process.env.SI_SECRETS_DIR ?? join(homedir(), '.secrets', 'student-invoice')

/** File names of the release assets. GitHub would turn spaces into dots anyway. */
export const msiName = (version) => `Student.Invoice_${version}_x64_en-US.msi`
export const assetUrl = (tag, name) => `https://github.com/${REPO}/releases/download/${tag}/${name}`

export function die(message) {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

export function step(message) {
  console.log(`\n▶ ${message}`)
}

// pnpm is a .cmd shim on Windows, which Node can only start through a shell.
// Everything else runs without a shell so arguments with spaces stay intact.
const needsShell = (cmd) => process.platform === 'win32' && cmd === 'pnpm'

/** Run a command, streaming output; exit on failure. Never pass secrets in args. */
export function run(cmd, args, opts = {}) {
  if (needsShell(cmd) && args.some((a) => /[\s"&|<>^]/.test(a))) die(`unsafe argument for shell command ${cmd}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: needsShell(cmd), ...opts })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} failed (exit ${r.status ?? r.error?.message})`)
}

export function capture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: needsShell(cmd), ...opts }).trim()
}

export function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v)
}

export function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

/**
 * Reproduces exactly how v1.0.1 reads the update notes
 * (src-tauri/src/lib.rs check_for_updates in v1.0.1):
 *   format!(r#"{"available": true, "version": "{}", "body": "{}"}"#, version, notes)
 * followed by JSON.parse in the UI. Returns an error message or null.
 */
export function v101CompatError(version, notes) {
  if (!LATEST_JSON_NOTES_PATTERN.test(notes)) {
    return `latest.json notes must match ${LATEST_JSON_NOTES_PATTERN} (got ${JSON.stringify(notes)})`
  }
  const spliced = `{"available": true, "version": "${version}", "body": "${notes}"}`
  try {
    const parsed = JSON.parse(spliced)
    if (parsed.body !== notes || parsed.version !== version) return 'notes/version do not round-trip through v1.0.1 parsing'
  } catch (e) {
    return `v1.0.1 would fail to parse the update response: ${e.message}`
  }
  return null
}

/** The files that carry the app version, as rewritten by bumpVersion. */
export const VERSION_FILES = ['app/package.json', 'app/src-tauri/tauri.conf.json', 'app/src-tauri/Cargo.toml', 'app/src-tauri/Cargo.lock']

/**
 * Sets the app version in every VERSION_FILES entry under `root`. Exits
 * without writing anything if the version can't be found in Cargo.toml or
 * Cargo.lock.
 */
export function bumpVersion(root, version) {
  const [pkgFile, confFile, tomlFile, lockFile] = VERSION_FILES
  const json = (file) => {
    const obj = JSON.parse(readFileSync(join(root, file), 'utf8'))
    obj.version = version
    return [file, JSON.stringify(obj, null, 2) + '\n']
  }
  const toml = (file, re) => {
    const text = readFileSync(join(root, file), 'utf8')
    if (!re.test(text)) die(`could not find the version in ${file}`)
    return [file, text.replace(re, `$1${version}$2`)]
  }
  const updated = [
    json(pkgFile),
    json(confFile),
    toml(tomlFile, /(\[package\][\s\S]*?\nversion = ")[^"]+(")/),
    toml(lockFile, /(\[\[package\]\]\nname = "student-invoice-tauri"\nversion = ")[^"]+(")/),
  ]
  for (const [file, text] of updated) writeFileSync(join(root, file), text)
}

/** The MSI that `tauri build` made for `version`. Exits if it or its `.sig` is missing. */
export function findSignedMsi(root, version) {
  const bundleDir = join(root, 'app/src-tauri/target/release/bundle/msi')
  const built = readdirSync(bundleDir).find((f) => f.endsWith(`_${version}_x64_en-US.msi`))
  if (!built || !existsSync(join(bundleDir, `${built}.sig`))) die(`signed MSI for ${version} not found in ${bundleDir}`)
  return join(bundleDir, built)
}

/**
 * Exits unless `msi`'s .sig is a valid signature of exactly that file by the
 * updater key installed copies trust. Catches a stale .sig left over from an
 * earlier build, which would make every installed copy reject the update.
 */
export function checkMsiSignature(msi) {
  if (!verifySignature(readFileSync(msi), readFileSync(`${msi}.sig`, 'utf8'))) {
    die(`${msi}.sig is not a valid signature of this MSI by the updater key. Rebuild before releasing.`)
  }
}

/**
 * Copies a signed MSI (from findSignedMsi) and its signature into `outDir`
 * under the release asset name, then writes the latest.json that installed
 * copies read, offering the MSI at `url`. Its shape is compatibility-critical
 * (docs/compatibility.md). Exits before writing it if v1.0.1 couldn't parse it.
 */
export function collectSignedMsi(msi, outDir, { version, notes, url, minimumSupportedVersion }) {
  if (minimumSupportedVersion !== undefined && !(isSemver(minimumSupportedVersion) && compareSemver(minimumSupportedVersion, version) <= 0)) {
    die(`minimum supported version must be x.y.z and no higher than ${version} (got ${JSON.stringify(minimumSupportedVersion)})`)
  }
  mkdirSync(outDir, { recursive: true })
  copyFileSync(msi, join(outDir, msiName(version)))
  copyFileSync(`${msi}.sig`, join(outDir, `${msiName(version)}.sig`))
  const signature = readFileSync(join(outDir, `${msiName(version)}.sig`), 'utf8').trim()
  const platform = { signature, url }
  const latest = {
    version,
    notes,
    pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    // Optional emergency safety net: older versions show the update as important
    // (docs/decisions/0002-no-forced-updates.md). Updaters ignore unknown fields.
    ...(minimumSupportedVersion && { minimumSupportedVersion }),
    // updater ≤2.9 (v1.0.1) reads only the generic key; newer updaters prefer the -msi key.
    platforms: { 'windows-x86_64': platform, 'windows-x86_64-msi': platform },
  }
  const err = v101CompatError(latest.version, latest.notes)
  if (err) die(err)
  writeFileSync(join(outDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')
}

/**
 * Pulls a version's section out of CHANGELOG.md (Keep a Changelog format).
 * Returns { body, summary, minimumSupportedVersion } where summary is the
 * one-line latest.json notes taken from `<!-- latest-json-summary: ... -->`
 * inside the section, and minimumSupportedVersion comes from an optional
 * `<!-- minimum-supported-version: x.y.z -->` (emergencies only).
 */
export function changelogSection(changelog, version) {
  const re = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm')
  const m = changelog.match(re)
  if (!m) return null
  const summary = m[1].match(/<!--\s*latest-json-summary:\s*(.*?)\s*-->/)?.[1]
  const minimumSupportedVersion = m[1].match(/<!--\s*minimum-supported-version:\s*(.*?)\s*-->/)?.[1]
  const body = m[1].replace(/<!--[\s\S]*?-->\n?/g, '').trim()
  return { body, summary, minimumSupportedVersion }
}

/** Locations of the secrets the release build needs (never read into logs). */
export function secretPaths() {
  return {
    signingKey: join(SECRETS_DIR, 'myapp.key'),
    googleClient: join(SECRETS_DIR, 'google-oauth-client.json'),
  }
}

const ESC = String.fromCharCode(27)

/**
 * Asks for a secret in the terminal without echoing it. It needs an
 * interactive terminal, so steps that sign are run by the owner, not a tool.
 */
export function askHidden(question) {
  const { stdin, stdout } = process
  if (!stdin.isTTY) die('This step asks for a password. Run it yourself in a terminal.')
  return new Promise((resolve) => {
    const typed = []
    const onData = (data) => {
      // Terminals may wrap a paste in ESC[200~ ... ESC[201~ (bracketed paste).
      const chunk = data.split(`${ESC}[200~`).join('').split(`${ESC}[201~`).join('')
      if (chunk.startsWith(ESC)) return // arrow keys and other escape sequences
      for (const ch of chunk) {
        const code = ch.charCodeAt(0)
        if (code === 3) {
          // Ctrl+C
          stdin.setRawMode(false)
          stdout.write(EOL)
          process.exit(130)
        } else if (code === 13 || code === 10) {
          stdin.off('data', onData)
          stdin.setRawMode(false)
          stdin.pause()
          stdout.write(EOL)
          resolve(typed.join(''))
          return
        } else if (code === 8 || code === 127) {
          typed.pop()
        } else if (code >= 32) {
          typed.push(ch)
        }
      }
    }
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
    stdin.resume()
  })
}

/** Asks for the signing key password and checks it at once. It is never stored. */
async function askSigningPassword(keyPath) {
  const keyText = readFileSync(keyPath, 'utf8')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const password = await askHidden('Signing key password (from Bitwarden): ')
    try {
      unlock(keyText, password)
      return password
    } catch {
      console.error('That password does not unlock the signing key.')
    }
  }
  die('Signing key not unlocked.')
}

/**
 * Environment for `tauri build`: the signing key, its password (asked for in
 * the terminal) and the Google client. Call it before any long-running step,
 * so the password prompt comes first.
 */
export async function buildEnv() {
  const p = secretPaths()
  if (!existsSync(p.signingKey)) die(`Signing key not found at ${p.signingKey}. Restore it from your password manager (see docs/release.md).`)
  // Release builds must have Gmail: build.rs embeds this client (docs/gmail.md).
  if (!existsSync(p.googleClient)) die(`Google OAuth client file not found at ${p.googleClient}. Restore it from your password manager.`)
  let c
  try {
    c = JSON.parse(readFileSync(p.googleClient, 'utf8'))
  } catch {
    // Never let the parser's message through: it quotes the file, which holds the secret.
    die(`${p.googleClient} isn't valid JSON. Download it again from Google Cloud Console or restore it from your password manager.`)
  }
  const creds = c.installed ?? c
  if (!creds.client_id || !creds.client_secret) die(`${p.googleClient} has no installed.client_id/client_secret (is it a Desktop app client?)`)
  return {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: p.signingKey, // Tauri accepts a path
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: await askSigningPassword(p.signingKey),
    SI_GOOGLE_CLIENT_ID: creds.client_id,
    SI_GOOGLE_CLIENT_SECRET: creds.client_secret,
  }
}
