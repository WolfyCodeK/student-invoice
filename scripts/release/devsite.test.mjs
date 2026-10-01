// The dev.wolfyk.com copy of latest.json (docs/release.md "dev.wolfyk.com").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { devsiteLatestPath, devsiteUrl, writeDevsiteLatest } from './devsite.mjs'
import { UPDATER_FEED } from '../invariants.config.mjs'

test('version files sit next to the feed, under the version tag', () => {
  assert.equal(UPDATER_FEED, 'https://dev.wolfyk.com/releases/student-invoice/latest.json')
  assert.equal(
    devsiteUrl('v1.1.2', 'Student.Invoice_1.1.2_x64_en-US.msi'),
    'https://dev.wolfyk.com/releases/student-invoice/v1.1.2/Student.Invoice_1.1.2_x64_en-US.msi',
  )
})

test("the site's latest.json is GitHub's, offering the installer from the site", () => {
  const outDir = mkdtempSync(join(tmpdir(), 'si-devsite-test-'))
  try {
    const github = {
      version: '1.1.2',
      notes: 'Student Invoice 1.1.2: paid and thanks ticks',
      pub_date: '2026-10-01T12:00:00Z',
      platforms: {
        'windows-x86_64': { signature: 'sig', url: 'https://github.com/x/releases/download/v1.1.2/Student.Invoice_1.1.2_x64_en-US.msi' },
        'windows-x86_64-msi': { signature: 'sig', url: 'https://github.com/x/releases/download/v1.1.2/Student.Invoice_1.1.2_x64_en-US.msi' },
      },
    }
    writeFileSync(join(outDir, 'latest.json'), JSON.stringify(github))
    writeDevsiteLatest(outDir, '1.1.2')
    const site = JSON.parse(readFileSync(devsiteLatestPath(outDir), 'utf8'))
    const url = 'https://dev.wolfyk.com/releases/student-invoice/v1.1.2/Student.Invoice_1.1.2_x64_en-US.msi'
    assert.deepEqual(site, {
      ...github,
      platforms: { 'windows-x86_64': { signature: 'sig', url }, 'windows-x86_64-msi': { signature: 'sig', url } },
    })
    // The GitHub copy is left as it was.
    assert.deepEqual(JSON.parse(readFileSync(join(outDir, 'latest.json'), 'utf8')), github)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})
