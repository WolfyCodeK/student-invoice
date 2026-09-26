// Tests for the secret scan (scripts/check-secrets.mjs) and the shared list of
// secret files. Run: node --test "scripts/**/*.test.mjs"
//
// The fake secrets are assembled at run time, so this file never contains
// anything the scanner (or gitleaks, or GitHub push protection) matches.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitObjects } from '../lib/repo.mjs'
import { secretFileKinds } from '../lib/secret-files.mjs'

const SCANNER = fileURLToPath(new URL('../check-secrets.mjs', import.meta.url))
const fake = {
  googleSecret: 'GOCSPX' + '-' + 'A'.repeat(12),
  apiKey: 'AI' + 'za' + 'B'.repeat(35),
  accessToken: 'ya' + '29.' + 'c'.repeat(25),
  githubToken: 'gh' + 'p_' + 'e'.repeat(36),
  anthropicKey: 'sk' + '-ant-' + 'f'.repeat(25),
}

test('secretFileKinds blocks secret files anywhere in the repo, and nothing else', () => {
  const blocked = {
    '.env': '.env file',
    'app/.env': '.env file',
    '.env.local': '.env file',
    'app/src-tauri/.env.production': '.env file',
    'myapp.key': 'key file',
    'keys/myapp.key.pub': 'key file',
    'client_secret_123.apps.googleusercontent.com.json': 'Google client secret file',
    'x/CLIENT_SECRET.json': 'Google client secret file',
    'google-oauth-client.json': 'OAuth credentials file',
    'secrets/Google-OAuth.json': 'OAuth credentials file',
  }
  for (const [path, kind] of Object.entries(blocked)) assert.deepEqual(secretFileKinds(path), [kind], path)
  for (const path of ['.env.example', 'app/.env.example', '.envrc', 'environment.ts', 'myapp.keys', 'key.ts', 'client_secret.txt', 'oauth.json', 'scripts/lib/secret-files.mjs']) {
    assert.deepEqual(secretFileKinds(path), [], path)
  }
})

/** A temp git repo, removed after the test. */
function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'si-secrets-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', ...args], { cwd: dir, encoding: 'utf8' })
  const put = (path, content) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  git('init', '-q')
  git('config', 'core.autocrlf', 'false')
  return { dir, git, put }
}

const scan = (dir, mode) => spawnSync(process.execPath, [SCANNER, mode], { cwd: dir, encoding: 'utf8' })

test('check-secrets reports committed and staged secrets by file and line, never the value', (t) => {
  const { dir, git, put } = repo(t)
  put('a.txt', `fine\n${fake.googleSecret}\n${fake.apiKey} and ${fake.accessToken}\n`)
  put('dir with space/b.md', `# B\n${fake.githubToken}\n`)
  put('naïve café.txt', `${fake.apiKey}\n`) // git quotes this name unless listed with -z
  put('binary.dat', Buffer.concat([Buffer.from(fake.apiKey), Buffer.from([0])]))
  put('.env', `KEY=${fake.anthropicKey}\n`)
  put('.env.example', `KEY=${fake.anthropicKey}\n`)
  put('keys/myapp.key', 'x\n')
  put('scripts/check-secrets.mjs', `${fake.googleSecret}\n`) // allow-listed: holds the patterns
  put('empty.txt', '')
  git('add', '-A')
  git('commit', '-q', '-m', 'fixture')
  put('a.txt', 'fine\n')
  put('staged.txt', `x\n${fake.githubToken}\n`)
  git('add', 'a.txt', 'staged.txt')

  const all = scan(dir, '--all')
  assert.equal(all.status, 1)
  assert.equal(
    all.stderr,
    [
      'Possible secrets found (values not shown):',
      '  .env: .env file must not be committed',
      '  .env:1: possible Anthropic API key',
      '  .env.example:1: possible Anthropic API key',
      '  a.txt:2: possible Google OAuth client secret',
      '  a.txt:3: possible Google API key',
      '  a.txt:3: possible Google OAuth access token',
      '  dir with space/b.md:2: possible GitHub token',
      '  keys/myapp.key: key file must not be committed',
      '  naïve café.txt:1: possible Google API key',
      '',
      'Move secrets to %USERPROFILE%\\.secrets\\student-invoice (see docs/security.md).',
      '',
    ].join('\n'),
  )
  for (const value of Object.values(fake)) assert.ok(!all.stderr.includes(value))

  // --staged scans the index: a.txt is clean there, staged.txt is new.
  const staged = scan(dir, '--staged')
  assert.equal(staged.status, 1)
  assert.match(staged.stderr, /^Possible secrets found \(values not shown\):\n {2}staged\.txt:2: possible GitHub token\n\n/)

  // Once the secrets are gone, the scan passes.
  git('rm', '-q', '.env', '.env.example', 'keys/myapp.key', 'binary.dat', 'naïve café.txt')
  put('dir with space/b.md', '# B\n')
  put('staged.txt', 'x\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'remove secrets')
  const clean = scan(dir, '--all')
  assert.equal(clean.status, 0, clean.stderr)
  assert.equal(clean.stdout, 'check-secrets: 5 file(s) clean\n')
})

test('gitObjects reads committed and staged blobs in one call', (t) => {
  const { dir, git, put } = repo(t)
  put('a.txt', 'one\ntwo\n')
  put('no-newline.txt', 'end')
  put('empty.txt', '')
  put('bin.dat', Buffer.from([0, 10, 13, 255]))
  git('add', '-A')
  git('commit', '-q', '-m', 'fixture')
  put('a.txt', 'staged\n')
  git('add', 'a.txt')

  const names = ['HEAD:a.txt', 'HEAD:missing.txt', 'HEAD:no-newline.txt', ':a.txt', 'HEAD:empty.txt', 'HEAD:bin.dat']
  const got = gitObjects(names, dir)
  assert.deepEqual([...got.keys()], ['HEAD:a.txt', 'HEAD:no-newline.txt', ':a.txt', 'HEAD:empty.txt', 'HEAD:bin.dat'])
  assert.equal(got.get('HEAD:a.txt').toString(), 'one\ntwo\n')
  assert.equal(got.get('HEAD:no-newline.txt').toString(), 'end')
  assert.equal(got.get(':a.txt').toString(), 'staged\n')
  assert.equal(got.get('HEAD:empty.txt').length, 0)
  assert.deepEqual([...got.get('HEAD:bin.dat')], [0, 10, 13, 255])
  assert.equal(gitObjects([], dir).size, 0)
})
