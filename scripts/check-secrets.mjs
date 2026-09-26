#!/usr/bin/env node
// Blocks secrets from being committed. Runs in the pre-commit hook (staged
// content) and in CI (all tracked files). CI additionally runs gitleaks.
// Matches are reported by file and line with the value masked, never printed.
//
// Usage: node scripts/check-secrets.mjs --staged | --all
import { repoRoot, gitObjects, gitPaths } from './lib/repo.mjs'
import { secretFileKinds } from './lib/secret-files.mjs'

const PATTERNS = [
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]{10,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Google OAuth access token', /\bya29\.[0-9A-Za-z_-]{20,}/],
  ['Google OAuth refresh token', /\b1\/\/0[0-9A-Za-z_-]{20,}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['minisign/rsign secret key', /(?:rsign|minisign) encrypted secret key/],
  ['Base64 minisign secret key', /dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5|dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['Hard-coded signing key password', /TAURI_SIGNING_PRIVATE_KEY_PASSWORD\s*=\s*["'][^"'$]+["']/],
  ['Hard-coded client secret', /client_?secret["']?\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i],
]

// This file contains the patterns it looks for, so its content isn't scanned.
const ALLOW_FILES = new Set(['scripts/check-secrets.mjs'])

const mode = process.argv[2]
if (mode !== '--staged' && mode !== '--all') {
  console.error('usage: check-secrets.mjs --staged | --all')
  process.exit(2)
}

const root = repoRoot()
const files =
  mode === '--staged'
    ? gitPaths(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
    : gitPaths(['ls-files'], root)

// The staged (`:path`) or committed (`HEAD:path`) version of every file, in one git call.
const object = (file) => (mode === '--staged' ? `:${file}` : `HEAD:${file}`)
const contents = gitObjects(files.filter((f) => !ALLOW_FILES.has(f)).map(object), root)

const findings = []
for (const file of files) {
  for (const kind of secretFileKinds(file)) findings.push(`${file}: ${kind} must not be committed`)
  const content = contents.get(object(file))
  // Missing when allow-listed or not in HEAD yet (--all); binaries are skipped.
  if (!content || content.includes(0)) continue
  const lines = content.toString('utf8').split('\n')
  lines.forEach((line, i) => {
    for (const [label, re] of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${i + 1}: possible ${label}`)
    }
  })
}

if (findings.length) {
  console.error('Possible secrets found (values not shown):\n  ' + findings.join('\n  '))
  console.error('\nMove secrets to %USERPROFILE%\\.secrets\\student-invoice (see docs/security.md).')
  process.exit(1)
}
console.log(`check-secrets: ${files.length} file(s) clean`)
