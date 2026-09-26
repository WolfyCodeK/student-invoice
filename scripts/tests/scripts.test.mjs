// Tests for the repo tooling. Run: node --test "scripts/**/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { v101CompatError, changelogSection, compareSemver } from '../release/lib.mjs'
import { globToRegExp, listFiles } from '../lib/repo.mjs'

test('v1.0.1 compatibility validator accepts plain one-line notes', () => {
  assert.equal(v101CompatError('1.1.0', 'New design, data export and import, bug and security fixes'), null)
  assert.equal(v101CompatError('1.0.1', 'Student Invoice 1.0.1'), null)
})

test('v1.0.1 compatibility validator rejects anything that could break its JSON parsing', () => {
  for (const notes of ['Say "hi"', 'line1\nline2', 'tab\there', 'back\\slash', '50% off!', '', 'x'.repeat(201), 'emoji 🎉']) {
    assert.notEqual(v101CompatError('1.1.0', notes), null, `should reject ${JSON.stringify(notes)}`)
  }
})

test('changelogSection extracts body and latest.json summary', () => {
  const cl = [
    '# Changelog', '', '## [Unreleased]', '',
    '## [1.1.0] - 2026-10-01', '<!-- latest-json-summary: New design and data transfer -->', '### Added', '- Thing', '',
    '## [1.0.1] - 2026-02-05', '### Fixed', '- x', '',
  ].join('\n')
  assert.deepEqual(changelogSection(cl, '1.1.0'), { body: '### Added\n- Thing', summary: 'New design and data transfer', minimumSupportedVersion: undefined })
  assert.deepEqual(changelogSection(cl, '1.0.1'), { body: '### Fixed\n- x', summary: undefined, minimumSupportedVersion: undefined })
  assert.equal(changelogSection(cl, '9.9.9'), null)
})

test('compareSemver orders numerically', () => {
  assert.ok(compareSemver('1.1.0', '1.0.1') > 0)
  assert.ok(compareSemver('1.0.10', '1.0.9') > 0)
  assert.equal(compareSemver('1.0.1', '1.0.1'), 0)
})

test('globToRegExp', () => {
  const m = (g, p) => globToRegExp(g).test(p)
  assert.ok(m('app/src/**', 'app/src/a/b.ts'))
  assert.ok(m('app/src/**', 'app/src/a.ts'))
  assert.ok(m('docs/**/*.md', 'docs/a.md'))
  assert.ok(m('docs/**/*.md', 'docs/x/y/a.md'))
  assert.ok(m('app/*.{ts,js}', 'app/vite.config.ts'))
  assert.ok(!m('app/*.{ts,js}', 'app/src/main.ts'))
  assert.ok(m('app/tsconfig*.json', 'app/tsconfig.node.json'))
  assert.ok(!m('app/src/*.ts', 'app/src/a/b.ts'))
})

test('listFiles lists matching files recursively as forward-slash repo paths', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'si-list-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const f of ['docs/a.md', 'docs/b.txt', 'docs/audits/c.md', 'docs/audits/deep/d.md', 'other/e.md']) {
    mkdirSync(join(root, f, '..'), { recursive: true })
    writeFileSync(join(root, f), '')
  }
  assert.deepEqual(listFiles('docs', '.md', root).sort(), ['docs/a.md', 'docs/audits/c.md', 'docs/audits/deep/d.md'])
  assert.deepEqual(listFiles('missing', '.md', root), [])
})
