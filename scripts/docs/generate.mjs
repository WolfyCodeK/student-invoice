#!/usr/bin/env node
// Regenerates the machine-derived sections of the docs, so facts that can be
// read from the code are never hand-maintained.
//
// A generated section looks like:
//   <!-- GEN:tauri-commands -->
//   ...replaced on every run...
//   <!-- /GEN:tauri-commands -->
//
// Usage:
//   node scripts/docs/generate.mjs          rewrite docs in place
//   node scripts/docs/generate.mjs --check  exit 1 if any section is stale
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { repoRoot, readRepoFile } from '../lib/repo.mjs'
import { INVARIANTS } from '../invariants.config.mjs'

const root = repoRoot()
const check = process.argv.includes('--check')

// ---------------------------------------------------------------------------
// Tauri commands (parsed from Rust) + consistency with registration and ACL
// ---------------------------------------------------------------------------
function rustFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? rustFiles(join(dir, e.name)) : e.name.endsWith('.rs') ? [join(dir, e.name).replace(/\\/g, '/')] : [],
  )
}

/** Splits on commas that are not inside <...> or (...) (e.g. `State<'_, T>`). */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '<' || ch === '(') depth++
    if (ch === '>' || ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts
}

export function parseCommands() {
  const commands = []
  for (const file of rustFiles('app/src-tauri/src')) {
    const lines = readRepoFile(file).split('\n')
    lines.forEach((line, i) => {
      if (!/^\s*#\[tauri::command/.test(line)) return
      const docs = []
      for (let j = i - 1; j >= 0 && /^\s*(\/\/\/|#\[)/.test(lines[j]); j--) {
        const m = lines[j].match(/^\s*\/\/\/\s?(.*)$/)
        if (m) docs.unshift(m[1])
      }
      const sigText = lines.slice(i + 1, i + 30).join('\n')
      const sig = sigText.match(/(?:pub\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*(?:->\s*([^{]+))?\{/)
      if (!sig) throw new Error(`${file}:${i + 1}: could not parse command signature`)
      const args = splitTopLevel(sig[3])
        .map((a) => a.trim())
        .filter(Boolean)
        .filter((a) => !/:\s*(tauri::)?(AppHandle|State<|Window|WebviewWindow)/.test(a))
        .map((a) => a.replace(/\s+/g, ' '))
      commands.push({
        name: sig[2],
        async: Boolean(sig[1]),
        args,
        returns: (sig[4] ?? '()').trim(),
        doc: docs.join(' ').trim(),
        file,
        line: i + 1,
      })
    })
  }
  return commands
}

function registeredCommands() {
  const lib = readRepoFile('app/src-tauri/src/lib.rs')
  const m = lib.match(/generate_handler!\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('generate_handler! not found in lib.rs')
  return m[1].split(',').map((s) => s.trim().split('::').pop()).filter(Boolean)
}

function manifestCommands() {
  const build = readRepoFile('app/src-tauri/build.rs')
  const m = build.match(/const COMMANDS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/) ?? build.match(/\.commands\(\s*&\[([\s\S]*?)\]\s*\)/)
  if (!m) return null // no app ACL manifest yet: every registered command is callable
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

function capabilityFiles() {
  const dir = 'app/src-tauri/capabilities'
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: `${dir}/${f}`, ...JSON.parse(readRepoFile(`${dir}/${f}`)) }))
}

function genTauriCommands() {
  const cmds = parseCommands()
  const registered = registeredCommands()
  const manifest = manifestCommands()
  const allowed = new Set(
    capabilityFiles().flatMap((c) => c.permissions.filter((p) => typeof p === 'string' && p.startsWith('allow-')).map((p) => p.slice(6).replace(/-/g, '_'))),
  )
  const errors = []
  for (const c of cmds) if (!registered.includes(c.name)) errors.push(`command ${c.name} (${c.file}:${c.line}) is not in generate_handler!`)
  for (const r of registered) if (!cmds.some((c) => c.name === r)) errors.push(`generate_handler! lists ${r} but no #[tauri::command] fn ${r} exists`)
  if (manifest) {
    for (const r of registered) if (!manifest.includes(r)) errors.push(`${r} is registered but missing from the build.rs AppManifest command list`)
    for (const m of manifest) if (!registered.includes(m)) errors.push(`build.rs AppManifest lists ${m} but it is not registered`)
    for (const r of registered) if (!allowed.has(r)) errors.push(`${r} has no allow-${r.replace(/_/g, '-')} permission in capabilities/ (the webview cannot call it)`)
  }
  if (errors.length) throw new Error('Tauri command inventory is inconsistent:\n  ' + errors.join('\n  '))

  const acl = manifest
    ? 'Only commands granted an `allow-<command>` permission in `app/src-tauri/capabilities/` can be called from the webview.'
    : '**No app ACL manifest yet:** every registered command can be called by any script running in the webview.'
  const rows = cmds
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `| \`${c.name}\` | ${c.args.length ? c.args.map((a) => '`' + a + '`').join('<br>') : '—'} | \`${c.returns.replace(/\|/g, '\\|')}\` | ${c.doc || '—'} | \`${c.file.replace('app/src-tauri/', '')}:${c.line}\` |`)
  return [acl, '', '| Command | Arguments | Returns | Purpose | Defined at |', '|---|---|---|---|---|', ...rows].join('\n')
}

function genCapabilities() {
  return capabilityFiles()
    .map((c) => [`**\`${c.file}\`** (identifier \`${c.identifier}\`, windows: ${c.windows.map((w) => '`' + w + '`').join(', ')})`, '', ...c.permissions.map((p) => `- \`${typeof p === 'string' ? p : JSON.stringify(p)}\``)].join('\n'))
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Invariants table (from scripts/invariants.config.mjs)
// ---------------------------------------------------------------------------
function genInvariants() {
  const esc = (s) => s.replace(/\|/g, '\\|')
  return [
    '| Id | What | Must be | Why |',
    '|---|---|---|---|',
    ...INVARIANTS.map((i) => `| \`${i.id}\` | ${esc(i.what)} | ${esc(i.expected)} | ${esc(i.why)} |`),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Dependency versions (from lockfiles, so no install is needed)
// ---------------------------------------------------------------------------
function pnpmLockVersions() {
  const lock = readRepoFile('app/pnpm-lock.yaml')
  const importer = lock.split(/\nimporters:\n/)[1]?.split(/\n\S/)[0] ?? ''
  const out = {}
  for (const m of importer.matchAll(/\n {6}'?([@\w/.-]+)'?:\n {8}specifier: ([^\n]+)\n {8}version: ([^\s(\n]+)/g)) out[m[1]] = m[3]
  return out
}

function cargoLockVersions() {
  const lock = readRepoFile('app/src-tauri/Cargo.lock')
  const out = {}
  for (const m of lock.matchAll(/\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/g)) (out[m[1]] ??= []).push(m[2])
  return out
}

function genVersions() {
  const npm = pnpmLockVersions()
  const cargo = cargoLockVersions()
  const npmKeys = ['react', 'typescript', 'vite', 'tailwindcss', 'zustand', 'zod', 'react-hook-form', 'date-fns', '@tauri-apps/api', '@tauri-apps/cli', '@tauri-apps/plugin-opener', 'vitest', 'eslint']
  const cargoKeys = ['tauri', 'tauri-build', 'tauri-plugin-updater', 'tauri-plugin-opener', 'tauri-plugin-dialog', 'oauth2', 'reqwest', 'tokio']
  const rows = [
    ...npmKeys.filter((k) => npm[k]).map((k) => `| \`${k}\` | npm | ${npm[k]} |`),
    ...cargoKeys.filter((k) => cargo[k]).map((k) => `| \`${k}\` | crate | ${cargo[k].join(', ')} |`),
  ]
  return ['| Package | Kind | Locked version |', '|---|---|---|', ...rows].join('\n')
}

function genAppScripts() {
  const pkg = JSON.parse(readRepoFile('app/package.json'))
  return ['| `pnpm <script>` (run in `app/`) | Runs |', '|---|---|', ...Object.entries(pkg.scripts).map(([k, v]) => `| \`${k}\` | \`${v.replace(/\|/g, '\\|')}\` |`)].join('\n')
}

// ---------------------------------------------------------------------------
// Persisted-state and backup JSON Schemas (from the zod source of truth)
// ---------------------------------------------------------------------------
async function genSchema(exportName) {
  const modPath = join(root, 'app/src/lib/schema/index.ts')
  if (!existsSync(modPath)) throw new Error('app/src/lib/schema/index.ts does not exist yet')
  const mod = await import(pathToFileURL(modPath).href)
  const { z } = await import(pathToFileURL(join(root, 'app/node_modules/zod/index.js')).href)
  const schema = z.toJSONSchema(mod[exportName], { io: 'input', unrepresentable: 'any' })
  return '```json\n' + JSON.stringify(schema, null, 2) + '\n```'
}

const GENERATORS = {
  'tauri-commands': genTauriCommands,
  capabilities: genCapabilities,
  invariants: genInvariants,
  versions: genVersions,
  'app-scripts': genAppScripts,
  'persisted-schema': () => genSchema('persistedStateSchema'),
  'backup-schema': () => genSchema('backupFileSchema'),
}

// ---------------------------------------------------------------------------
function markdownFiles(dir) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? markdownFiles(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  )
}

const targets = [...markdownFiles('docs'), 'CLAUDE.md', 'README.md'].filter((f) => existsSync(join(root, f)))
const BLOCK = /<!-- GEN:([\w-]+) -->\n[\s\S]*?<!-- \/GEN:\1 -->/g
let stale = []
for (const file of targets) {
  const abs = join(root, file)
  const original = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
  let updated = original
  for (const [, name] of [...original.matchAll(BLOCK)]) {
    const gen = GENERATORS[name]
    if (!gen) throw new Error(`${file}: unknown generated section GEN:${name}`)
    const body = await gen()
    updated = updated.replace(new RegExp(`<!-- GEN:${name} -->\\n[\\s\\S]*?<!-- /GEN:${name} -->`), () => `<!-- GEN:${name} -->\n${body}\n<!-- /GEN:${name} -->`)
  }
  if (updated !== original) {
    stale.push(relative(root, abs).replace(/\\/g, '/'))
    if (!check) writeFileSync(abs, updated)
  }
}

if (check && stale.length) {
  console.error(`Generated doc sections are out of date in:\n  ${stale.join('\n  ')}\nRun: node scripts/docs/generate.mjs`)
  process.exit(1)
}
console.log(check ? 'docs/generate: all generated sections are current' : `docs/generate: updated ${stale.length} file(s)${stale.length ? ': ' + stale.join(', ') : ''}`)
