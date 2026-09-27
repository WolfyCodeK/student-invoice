// Tests for the release helpers that write files installed copies depend on:
// the version bump and latest.json. Run: node --test "scripts/**/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { VERSION_FILES, bumpVersion, changelogSection, checkMsiSignature, collectSignedMsi, findSignedMsi } from '../release/lib.mjs'

/** A temp folder with the given files, removed after the test. */
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'si-release-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

/** Makes die() throw instead of exiting; returns what it printed. */
function catchDie(t) {
  const printed = t.mock.method(console, 'error', () => {})
  t.mock.method(process, 'exit', (code) => {
    throw new Error(`exit ${code}`)
  })
  return () => printed.mock.calls.map((c) => c.arguments.join(' ')).join('\n')
}

const CARGO_TOML = `[package]
name = "student-invoice-tauri"
version = "1.0.1"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }

[package.metadata.other]
version = "9.9.9"
`

const CARGO_LOCK = `version = 4

[[package]]
name = "serde"
version = "1.0.1"

[[package]]
name = "student-invoice-tauri"
version = "1.0.1"
dependencies = [
 "serde",
]

[[package]]
name = "zzz"
version = "1.0.1"
`

const versionFixture = (t, lock = CARGO_LOCK) =>
  fixture(t, {
    'app/package.json': '{ "name": "student-invoice", "private": true, "version": "1.0.1", "scripts": { "dev": "vite" } }',
    'app/src-tauri/tauri.conf.json': '{\n  "productName": "Student Invoice",\n  "version": "1.0.1",\n  "identifier": "com.isaac.student-invoice"\n}\n',
    'app/src-tauri/Cargo.toml': CARGO_TOML,
    'app/src-tauri/Cargo.lock': lock,
  })

test('bumpVersion sets the app version in exactly the four version files', (t) => {
  const root = versionFixture(t)
  bumpVersion(root, '1.2.3')
  const read = (p) => readFileSync(join(root, p), 'utf8')
  assert.deepEqual(VERSION_FILES, ['app/package.json', 'app/src-tauri/tauri.conf.json', 'app/src-tauri/Cargo.toml', 'app/src-tauri/Cargo.lock'])
  // JSON files are rewritten with 2-space indentation and a final newline.
  assert.equal(read('app/package.json'), '{\n  "name": "student-invoice",\n  "private": true,\n  "version": "1.2.3",\n  "scripts": {\n    "dev": "vite"\n  }\n}\n')
  assert.equal(read('app/src-tauri/tauri.conf.json'), '{\n  "productName": "Student Invoice",\n  "version": "1.2.3",\n  "identifier": "com.isaac.student-invoice"\n}\n')
  // Only the package's own version changes, not dependencies or other tables.
  assert.equal(read('app/src-tauri/Cargo.toml'), CARGO_TOML.replace('version = "1.0.1"', 'version = "1.2.3"'))
  assert.equal(read('app/src-tauri/Cargo.lock'), CARGO_LOCK.replace('name = "student-invoice-tauri"\nversion = "1.0.1"', 'name = "student-invoice-tauri"\nversion = "1.2.3"'))
})

test('bumpVersion exits without writing anything if the Cargo.lock entry is missing', (t) => {
  const root = versionFixture(t, CARGO_LOCK.replace('student-invoice-tauri', 'renamed'))
  const printed = catchDie(t)
  assert.throws(() => bumpVersion(root, '1.2.3'), /exit 1/)
  assert.match(printed(), /could not find the version in app\/src-tauri\/Cargo\.lock/)
  assert.match(readFileSync(join(root, 'app/package.json'), 'utf8'), /"version": "1\.0\.1"/)
  assert.equal(readFileSync(join(root, 'app/src-tauri/Cargo.toml'), 'utf8'), CARGO_TOML)
})

const BUNDLE = 'app/src-tauri/target/release/bundle/msi'

test('collectSignedMsi copies the signed MSI and writes the latest.json v1.0.1 reads', (t) => {
  const root = fixture(t, {
    [`${BUNDLE}/Student Invoice_1.2.2_x64_en-US.msi`]: 'old',
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi`]: 'msi bytes',
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi.sig`]: 'c2lnbmF0dXJl\n',
  })
  const outDir = join(root, 'out')
  const msi = findSignedMsi(root, '1.2.3')
  assert.equal(msi, join(root, BUNDLE, 'Student Invoice_1.2.3_x64_en-US.msi'))
  const before = Math.floor(Date.now() / 1000) * 1000
  collectSignedMsi(msi, outDir, { version: '1.2.3', notes: 'New design, data export and import', url: 'https://example.invalid/Student.Invoice_1.2.3_x64_en-US.msi' })
  const after = Date.now()

  assert.equal(readFileSync(join(outDir, 'Student.Invoice_1.2.3_x64_en-US.msi'), 'utf8'), 'msi bytes')
  assert.equal(readFileSync(join(outDir, 'Student.Invoice_1.2.3_x64_en-US.msi.sig'), 'utf8'), 'c2lnbmF0dXJl\n')
  // Byte for byte: key order, both platform keys, pub_date in UTC without milliseconds.
  const written = readFileSync(join(outDir, 'latest.json'), 'utf8')
  const pubDate = JSON.parse(written).pub_date
  assert.match(pubDate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)
  assert.ok(Date.parse(pubDate) >= before && Date.parse(pubDate) <= after)
  const platform = '{\n      "signature": "c2lnbmF0dXJl",\n      "url": "https://example.invalid/Student.Invoice_1.2.3_x64_en-US.msi"\n    }'
  assert.equal(
    written,
    `{\n  "version": "1.2.3",\n  "notes": "New design, data export and import",\n  "pub_date": "${pubDate}",\n  "platforms": {\n    "windows-x86_64": ${platform},\n    "windows-x86_64-msi": ${platform}\n  }\n}\n`,
  )
})

test('collectSignedMsi refuses notes that v1.0.1 could not parse', (t) => {
  const root = fixture(t, {
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi`]: 'msi bytes',
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi.sig`]: 'sig',
  })
  const printed = catchDie(t)
  const outDir = join(root, 'out')
  assert.throws(() => collectSignedMsi(findSignedMsi(root, '1.2.3'), outDir, { version: '1.2.3', notes: 'Say "hi"', url: 'u' }), /exit 1/)
  assert.match(printed(), /latest\.json notes must match/)
  assert.ok(!existsSync(join(outDir, 'latest.json')))
})

test('collectSignedMsi adds minimumSupportedVersion only when given, and checks it', (t) => {
  const root = fixture(t, {
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi`]: 'msi bytes',
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi.sig`]: 'sig',
  })
  const msi = findSignedMsi(root, '1.2.3')
  const outDir = join(root, 'out')
  collectSignedMsi(msi, outDir, { version: '1.2.3', notes: 'Fixes', url: 'u', minimumSupportedVersion: '1.2.0' })
  const latest = JSON.parse(readFileSync(join(outDir, 'latest.json'), 'utf8'))
  assert.deepEqual(Object.keys(latest), ['version', 'notes', 'pub_date', 'minimumSupportedVersion', 'platforms'])
  assert.equal(latest.minimumSupportedVersion, '1.2.0')

  const printed = catchDie(t)
  for (const bad of ['1.2.4', 'v1.2.0', '']) {
    assert.throws(() => collectSignedMsi(msi, join(root, `bad-${bad}`), { version: '1.2.3', notes: 'Fixes', url: 'u', minimumSupportedVersion: bad }), /exit 1/)
  }
  assert.match(printed(), /minimum supported version must be x\.y\.z and no higher than 1\.2\.3/)
})

test('changelogSection reads the summary and the optional minimum supported version', () => {
  const changelog = '# Changelog\n\n## [1.2.3] - 2026-10-01\n<!-- latest-json-summary: Fixes -->\n<!-- minimum-supported-version: 1.2.0 -->\n### Fixed\n- A thing.\n\n## [1.2.2]\n<!-- latest-json-summary: Older -->\n- Old.\n'
  assert.deepEqual(changelogSection(changelog, '1.2.3'), { body: '### Fixed\n- A thing.', summary: 'Fixes', minimumSupportedVersion: '1.2.0' })
  assert.deepEqual(changelogSection(changelog, '1.2.2'), { body: '- Old.', summary: 'Older', minimumSupportedVersion: undefined })
})

test('checkMsiSignature exits when the .sig does not verify against the updater key', (t) => {
  const root = fixture(t, {
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi`]: 'msi bytes',
    [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi.sig`]: 'c2lnbmF0dXJl\n', // not a real signature
  })
  const printed = catchDie(t)
  assert.throws(() => checkMsiSignature(findSignedMsi(root, '1.2.3')), /exit 1/)
  assert.match(printed(), /is not a valid signature of this MSI by the updater key/)
})

test('findSignedMsi exits when the signature is missing', (t) => {
  const root = fixture(t, { [`${BUNDLE}/Student Invoice_1.2.3_x64_en-US.msi`]: 'msi bytes' })
  const printed = catchDie(t)
  assert.throws(() => findSignedMsi(root, '1.2.3'), /exit 1/)
  assert.match(printed(), /signed MSI for 1\.2\.3 not found/)
})
