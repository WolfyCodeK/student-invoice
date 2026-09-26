#!/usr/bin/env node
// Enforces scripts/invariants.config.mjs. Exit code 1 lists every violation.
// Usage: node scripts/check-invariants.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INVARIANTS, UPDATER_ENDPOINT, UPDATER_PUBKEY } from './invariants.config.mjs'
import { repoRoot } from './lib/repo.mjs'

const root = repoRoot()
const read = (p) => readFileSync(join(root, p), 'utf8')
const conf = JSON.parse(read('app/src-tauri/tauri.conf.json'))
const cargo = read('app/src-tauri/Cargo.toml')
const pkg = JSON.parse(read('app/package.json'))
const store = read('app/src/stores/app-store.ts')
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)

const cargoPackage = (key) => cargo.match(new RegExp(`^\\[package\\][\\s\\S]*?^${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1]

/** @type {Record<string, () => string | null>} returns an error message or null */
const checks = {
  identifier: () => (conf.identifier === 'com.isaac.student-invoice' ? null : `identifier is ${conf.identifier}`),
  'https-scheme': () =>
    (conf.app?.windows ?? []).some((w) => w.useHttpsScheme === true) ? 'a window sets useHttpsScheme: true' : null,
  'product-name': () => (conf.productName === 'Student Invoice' ? null : `productName is ${conf.productName}`),
  publisher: () => (conf.bundle?.publisher === 'isaac' ? null : `bundle.publisher is ${conf.bundle?.publisher}`),
  'upgrade-code': () =>
    conf.bundle?.windows?.wix?.upgradeCode?.toLowerCase() === '236f3e14-f18d-5eff-88a5-407aa14b96c8'
      ? null
      : `wix.upgradeCode is ${conf.bundle?.windows?.wix?.upgradeCode}`,
  'binary-name': () => {
    if (cargoPackage('name') !== 'student-invoice-tauri') return `Cargo package name is ${cargoPackage('name')}`
    if (conf.mainBinaryName) return `mainBinaryName is set to ${conf.mainBinaryName}`
    return null
  },
  'updater-endpoint': () => {
    const e = conf.plugins?.updater?.endpoints
    return Array.isArray(e) && e.length === 1 && e[0] === UPDATER_ENDPOINT ? null : `endpoints are ${JSON.stringify(e)}`
  },
  'updater-pubkey': () => (conf.plugins?.updater?.pubkey === UPDATER_PUBKEY ? null : 'updater pubkey changed'),
  'install-mode': () => {
    if (conf.plugins?.updater?.windows?.installMode !== 'passive') return 'installMode is not passive'
    const t = conf.bundle?.targets
    return Array.isArray(t) && t.length === 1 && t[0] === 'msi' ? null : `bundle.targets is ${JSON.stringify(t)}`
  },
  'global-tauri': () => (conf.app?.withGlobalTauri ? 'app.withGlobalTauri is enabled in the shipped config' : null),
  'store-key': () => {
    if (!/name:\s*['"]student-invoice-store['"]/.test(store)) return 'persist name student-invoice-store not found'
    const v = store.match(/persist\([\s\S]*?\{[\s\S]*?\bversion:\s*(\d+)/)?.[1]
    return v === undefined || v === '0' ? null : `persist version is ${v}`
  },
  'theme-key': () => {
    const files = tracked.filter((f) => /^app\/src\/.*\.(ts|tsx)$/.test(f))
    return files.some((f) => read(f).includes('"student-invoice-theme"') || read(f).includes("'student-invoice-theme'"))
      ? null
      : 'theme storage key student-invoice-theme not found in app/src'
  },
  'versions-match': () => {
    const v = { 'package.json': pkg.version, 'Cargo.toml': cargoPackage('version'), 'tauri.conf.json': conf.version }
    return new Set(Object.values(v)).size === 1 ? null : `versions differ: ${JSON.stringify(v)}`
  },
  'no-secrets-tracked': () => {
    const bad = tracked.filter((f) => {
      const base = f.split('/').pop()
      return /^\.env(\..*)?$/.test(base) && base !== '.env.example'
        ? true
        : /\.key(\.pub)?$/.test(base) || /^client_secret.*\.json$/i.test(base) || /^google-oauth.*\.json$/i.test(base)
    })
    return bad.length ? `secret-like files are tracked: ${bad.join(', ')}` : null
  },
}

const failures = []
for (const inv of INVARIANTS) {
  const check = checks[inv.id]
  if (!check) {
    failures.push(`[${inv.id}] no check implemented`)
    continue
  }
  const err = check()
  if (err) failures.push(`[${inv.id}] ${err}\n    why it matters: ${inv.why}`)
}
for (const id of Object.keys(checks)) {
  if (!INVARIANTS.some((i) => i.id === id)) failures.push(`[${id}] check has no entry in invariants.config.mjs`)
}

if (failures.length) {
  console.error(`Compatibility invariants violated (see docs/compatibility.md):\n\n${failures.join('\n')}`)
  process.exit(1)
}
console.log(`check-invariants: all ${INVARIANTS.length} invariants hold`)
