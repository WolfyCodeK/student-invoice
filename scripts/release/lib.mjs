// Shared helpers for the release scripts. Node built-ins only.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { LATEST_JSON_NOTES_PATTERN } from '../invariants.config.mjs'

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
    signingPassword: join(SECRETS_DIR, 'signing-key-password.txt'),
    googleClient: join(SECRETS_DIR, 'google-oauth-client.json'),
  }
}

/** Environment for `tauri build`: signing key + password, and the Google client if present. */
export function buildEnv() {
  const p = secretPaths()
  if (!existsSync(p.signingKey)) die(`Signing key not found at ${p.signingKey}. Restore it from your password manager (see docs/release.md).`)
  if (!existsSync(p.signingPassword)) die(`Signing key password file not found at ${p.signingPassword}. Create it in Notepad containing only the password.`)
  const env = {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: p.signingKey, // Tauri accepts a path
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: readFileSync(p.signingPassword, 'utf8').replace(/\r?\n$/, ''),
  }
  // Release builds must have Gmail: build.rs embeds this client (docs/gmail.md).
  if (!existsSync(p.googleClient)) die(`Google OAuth client file not found at ${p.googleClient}. Restore it from your password manager.`)
  const c = JSON.parse(readFileSync(p.googleClient, 'utf8'))
  const creds = c.installed ?? c
  if (!creds.client_id || !creds.client_secret) die(`${p.googleClient} has no installed.client_id/client_secret (is it a Desktop app client?)`)
  env.SI_GOOGLE_CLIENT_ID = creds.client_id
  env.SI_GOOGLE_CLIENT_SECRET = creds.client_secret
  return env
}
