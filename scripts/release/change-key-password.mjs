#!/usr/bin/env node
// Changes the password of the updater signing key (myapp.key). The key itself
// stays the same, so installed copies keep accepting updates. Run it yourself
// in a terminal (it asks for passwords):
//
//   node scripts/release/change-key-password.mjs
//
// Procedure: docs/release.md ("The signing key password").
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repoRoot } from '../lib/repo.mjs'
import { SECRETS_DIR, askHidden, die, run, secretPaths, step } from './lib.mjs'
import { relock, unlock, verifySignature } from './signing-key.mjs'

const MIN_LENGTH = 16
const root = repoRoot()
const { signingKey } = secretPaths()
const newKey = `${signingKey}.new`
const oldKey = `${signingKey}.old`
if (!existsSync(signingKey)) die(`Signing key not found at ${signingKey}.`)
if (existsSync(oldKey)) die(`${oldKey} already exists. Delete it once Bitwarden has the current key, then run this again.`)
const keyText = readFileSync(signingKey, 'utf8')

const current = await askHidden('Current password: ')
try {
  unlock(keyText, current)
} catch {
  die('That is not the current password.')
}
const next = await askHidden(`New password (at least ${MIN_LENGTH} characters): `)
if ([...next].length < MIN_LENGTH) die(`The new password must be at least ${MIN_LENGTH} characters.`)
if (next === current) die('The new password is the same as the current one.')
if ((await askHidden('New password again: ')) !== next) die('The two new passwords are different.')

step('Re-locking the key with the new password')
writeFileSync(newKey, relock(keyText, current, next))

step("Checking it: Tauri's signer must sign with it, and the updater's public key must accept the signature")
const dir = mkdtempSync(join(tmpdir(), 'si-key-check-'))
try {
  const file = join(dir, 'check.txt')
  writeFileSync(file, `Student Invoice signing check ${new Date().toISOString()}`)
  const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: next }
  delete env.TAURI_SIGNING_PRIVATE_KEY // Tauri refuses a key and a key path together
  run('node', [join(root, 'app/node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '-f', newKey, file], { env })
  if (!verifySignature(readFileSync(file), readFileSync(`${file}.sig`, 'utf8'))) throw new Error('signature rejected')
} catch (e) {
  rmSync(newKey, { force: true })
  die(`The re-locked key failed its check (${e.message}). Nothing was changed.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

renameSync(signingKey, oldKey)
renameSync(newKey, signingKey)
console.log(`
✔ The signing key now uses the new password. Its public key is unchanged,
  so installed copies are unaffected.

Next:
  1. In Bitwarden, replace the myapp.key attachment with
     ${signingKey}
     and make sure the new password is saved in the same item.
  2. Delete ${oldKey}
     and any other old copies of myapp.key: they still open with the old password.`)
const passwordFile = join(SECRETS_DIR, 'signing-key-password.txt')
if (existsSync(passwordFile)) console.log(`  3. Delete ${passwordFile}: releases now ask for the password instead.`)
