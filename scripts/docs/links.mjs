#!/usr/bin/env node
// Catches docs that point at things that no longer exist:
//  - relative markdown links: [text](../app/src/foo.ts)
//  - backticked repo paths: `app/src/stores/app-store.ts` (optionally :line)
// and checks that docs/README.md links to every doc listed in docs-map.json.
import { existsSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { repoRoot, readRepoFile, listFiles } from '../lib/repo.mjs'

const root = repoRoot()
const PATH_PREFIXES = /^(app|scripts|docs|\.github|\.githooks|\.claude)\//
const problems = []

const files = [...listFiles('docs', '.md', root), 'CLAUDE.md', 'AGENTS.md', 'README.md', 'CHANGELOG.md'].filter((f) => existsSync(join(root, f)))

for (const file of files) {
  // Invisible control characters (e.g. a stray backspace from an escaping
  // mistake) silently corrupt paths and commands shown in the docs.
  const raw = readRepoFile(file, root)
  const control = raw.search(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F﻿]/)
  if (control !== -1) problems.push(`${file}: invisible control character at offset ${control}`)
  const text = raw
    .replace(/<!-- GEN:([\w-]+) -->[\s\S]*?<!-- \/GEN:\1 -->/g, '') // generated blocks are checked by generate.mjs
    .replace(/```[\s\S]*?```/g, '') // code fences
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const path = normalize(join(dirname(file), target.split('#')[0]))
    if (!existsSync(join(root, path))) problems.push(`${file}: broken link → ${target}`)
  }
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const raw = m[1]
    if (!PATH_PREFIXES.test(raw) || /[*{}<>]/.test(raw)) continue
    const path = raw.replace(/:\d+(-\d+)?$/, '').replace(/\/$/, '')
    if (!existsSync(join(root, path))) problems.push(`${file}: path does not exist → ${raw}`)
  }
}

const map = JSON.parse(readRepoFile('docs/docs-map.json', root))
const index = readRepoFile('docs/README.md', root)
for (const doc of Object.keys(map.docs)) {
  if (doc === 'docs/README.md') continue
  const rel = doc.replace(/^docs\//, '')
  if (!index.includes(`](${rel})`) && !index.includes(`](./${rel})`)) problems.push(`docs/README.md does not link to ${doc}`)
}

if (problems.length) {
  console.error('Doc link problems:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`docs/links: ${files.length} file(s) ok`)
