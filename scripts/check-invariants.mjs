#!/usr/bin/env node
// Enforces scripts/invariants.config.mjs. Exit code 1 lists every violation.
// Usage: node scripts/check-invariants.mjs
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { INVARIANTS, UPDATER_ENDPOINT, UPDATER_PUBKEY } from './invariants.config.mjs'
import { gitLines, readRepoFile, repoRoot } from './lib/repo.mjs'
import { secretFileKinds } from './lib/secret-files.mjs'

const root = repoRoot()
const read = (p) => readRepoFile(p, root)
const conf = JSON.parse(read('app/src-tauri/tauri.conf.json'))
const cargo = read('app/src-tauri/Cargo.toml')
const pkg = JSON.parse(read('app/package.json'))
const store = read('app/src/stores/app-store.ts')
const tracked = gitLines(['ls-files'], root)

const cargoPackage = (key) => cargo.match(new RegExp(`^\\[package\\][\\s\\S]*?^${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1]

/** @type {Record<string, () => string | null>} returns an error message or null */
const checks = {
  identifier: () => (conf.identifier === 'com.isaac.student-invoice' ? null : `identifier is ${conf.identifier}`),
  'https-scheme': () =>
    (conf.app?.windows ?? []).some((w) => w.useHttpsScheme === true) ? 'a window sets useHttpsScheme: true' : null,
  'data-directory': () =>
    (conf.app?.windows ?? []).some((w) => w.dataDirectory !== undefined) ? 'a window sets dataDirectory' : null,
  'no-platform-config': () => {
    // Checks the folder, not just tracked files: local release builds merge untracked ones too.
    const platform = /^(tauri\.(windows|linux|macos|android|ios)\.conf\.json5?|Tauri\.(windows|linux|macos|android|ios)\.toml)$/i
    const found = readdirSync(join(root, 'app/src-tauri')).filter((f) => platform.test(f))
    return found.length ? `platform config present: ${found.join(', ')}` : null
  },
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
  'mcp-bridge-dev-only': () => {
    const lib = read('app/src-tauri/src/lib.rs')
    const dep = cargo.match(/^tauri-plugin-mcp-bridge\s*=\s*(.+)$/m)?.[1]
    if (dep !== undefined && !/optional\s*=\s*true/.test(dep)) return 'tauri-plugin-mcp-bridge must be an optional dependency'
    const defaults = cargo.match(/^\[features\][\s\S]*?^default\s*=\s*\[([^\]]*)\]/m)?.[1] ?? ''
    if (/mcp-bridge/.test(defaults)) return 'mcp-bridge must not be a default feature'
    const uses = lib.split('\n').map((l, i) => [l, i]).filter(([l]) => l.includes('tauri_plugin_mcp_bridge'))
    for (const [, i] of uses) {
      const guard = lib.split('\n').slice(Math.max(0, i - 3), i).join('\n')
      if (!/#\[cfg\(all\(debug_assertions,\s*feature\s*=\s*"mcp-bridge"\)\)\]/.test(guard)) return `lib.rs:${i + 1} uses the MCP bridge without the dev-only cfg guard`
    }
    if (uses.length && !/bind_address\("127\.0\.0\.1"\)/.test(lib)) return 'MCP bridge must bind to 127.0.0.1'
    if (JSON.stringify(conf).includes('mcp-bridge')) return 'the shipped tauri.conf.json references the MCP bridge'
    return null
  },
  'store-key': () => {
    if (!/name:\s*['"]student-invoice-store['"]/.test(store)) return 'persist name student-invoice-store not found'
    const v = store.match(/persist\([\s\S]*?\{[\s\S]*?\bversion:\s*(\d+)/)?.[1]
    return v === undefined || v === '0' ? null : `persist version is ${v}`
  },
  'theme-key': () => {
    const files = tracked.filter((f) => /^app\/src\/.*\.(ts|tsx)$/.test(f))
    return files.some((f) => /(["'])student-invoice-theme\1/.test(read(f)))
      ? null
      : 'theme storage key student-invoice-theme not found in app/src'
  },
  'versions-match': () => {
    const v = { 'package.json': pkg.version, 'Cargo.toml': cargoPackage('version'), 'tauri.conf.json': conf.version }
    return new Set(Object.values(v)).size === 1 ? null : `versions differ: ${JSON.stringify(v)}`
  },
  'no-secrets-tracked': () => {
    const bad = tracked.filter((f) => secretFileKinds(f).length > 0)
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
