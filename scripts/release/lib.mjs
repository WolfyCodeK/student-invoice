// Shared helpers for the release scripts. Node built-ins only.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { EOL, homedir } from 'node:os'
import { join } from 'node:path'
import { LATEST_JSON_NOTES_PATTERN } from '../invariants.config.mjs'
import { unlock } from './signing-key.mjs'

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

/**
 * Pulls a version's section out of CHANGELOG.md (Keep a Changelog format).
 * Returns { body, summary } where summary is the one-line latest.json notes
 * taken from `<!-- latest-json-summary: ... -->` inside the section.
 */
export function changelogSection(changelog, version) {
  const re = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm')
  const m = changelog.match(re)
  if (!m) return null
  const summary = m[1].match(/<!--\s*latest-json-summary:\s*(.*?)\s*-->/)?.[1]
  const body = m[1].replace(/<!--[\s\S]*?-->\n?/g, '').trim()
  return { body, summary }
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
export async function askSigningPassword(keyPath) {
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
  const c = JSON.parse(readFileSync(p.googleClient, 'utf8'))
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
