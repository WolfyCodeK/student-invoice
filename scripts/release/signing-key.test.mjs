// Unit tests for signing-key.mjs, with keys made here in the minisign format.
// Compatibility with Tauri's signer and the updater's minisign-verify was
// checked separately with a throwaway key (docs/release.md).
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { test } from 'node:test'
import { readPublicKey, relock, scryptParams, seal, unlock, verifySignature } from './signing-key.mjs'

const b64 = (text) => Buffer.from(text).toString('base64')

/** A throwaway key pair in Tauri's file formats, with cheap scrypt settings. */
function makeKey(password) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url')
  const pk = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url')
  const keynum = randomBytes(8)
  const box = Buffer.alloc(158)
  box.write('EdScB2', 0, 'latin1')
  box.writeBigUInt64LE(32768n, 38) // opslimit
  box.writeBigUInt64LE(2097152n, 46) // memlimit: N = 1024, fast
  const plain = Buffer.concat([keynum, seed, pk, Buffer.alloc(32)])
  const keyFile = seal(plain, password, { comment: 'untrusted comment: test key', box })
  const pubkey = b64(`untrusted comment: minisign public key\n${Buffer.concat([Buffer.from('Ed'), keynum, pk]).toString('base64')}\n`)
  return { keyFile, pubkey, privateKey, keynum }
}

/** A prehashed ("ED") minisign signature, as Tauri writes it. */
function makeSig(data, { privateKey, keynum }) {
  const signature = sign(null, createHash('blake2b512').update(data).digest(), privateKey)
  const trusted = 'timestamp:1\tfile:test.msi'
  const global = sign(null, Buffer.concat([signature, Buffer.from(trusted)]), privateKey)
  const sigBox = Buffer.concat([Buffer.from('ED'), keynum, signature])
  return b64(`untrusted comment: sig\n${sigBox.toString('base64')}\ntrusted comment: ${trusted}\n${global.toString('base64')}\n`)
}

test('scrypt parameters match minisign for its defaults and for small limits', () => {
  assert.deepEqual(scryptParams(1048576n, 33554432n), { N: 32768, r: 8, p: 1 })
  assert.deepEqual(scryptParams(32768n, 2097152n), { N: 1024, r: 8, p: 1 })
})

test('unlock accepts only the right password for the trusted key', () => {
  const key = makeKey('old password')
  assert.doesNotThrow(() => unlock(key.keyFile, 'old password', key.pubkey))
  assert.throws(() => unlock(key.keyFile, 'wrong', key.pubkey), /wrong password/)
  assert.throws(() => unlock(key.keyFile, 'old password', makeKey('x').pubkey), /wrong password/)
})

test('relock changes the password, not the key', () => {
  const key = makeKey('old password')
  const relocked = relock(key.keyFile, 'old password', 'new password', key.pubkey)
  assert.throws(() => unlock(relocked, 'old password', key.pubkey))
  assert.deepEqual(unlock(relocked, 'new password', key.pubkey), unlock(key.keyFile, 'old password', key.pubkey))
  const lines = (f) => Buffer.from(f, 'base64').toString('utf8').split('\n')
  assert.equal(lines(relocked)[0], 'untrusted comment: test key')
  assert.throws(() => relock(key.keyFile, 'wrong', 'new password', key.pubkey))
})

test('verifySignature checks data, key and trusted comment', () => {
  const key = makeKey('pw')
  const data = Buffer.from('installer bytes')
  const sig = makeSig(data, key)
  assert.equal(verifySignature(data, sig, key.pubkey), true)
  assert.equal(verifySignature(Buffer.from('other bytes'), sig, key.pubkey), false)
  assert.equal(verifySignature(data, sig, makeKey('pw').pubkey), false)
  const forged = Buffer.from(sig, 'base64').toString('utf8').replace('file:test.msi', 'file:evil.msi')
  assert.equal(verifySignature(data, b64(forged), key.pubkey), false)
})

test('the real updater public key parses', () => {
  const { keynum, pk } = readPublicKey()
  assert.equal(Buffer.from(keynum).reverse().toString('hex').toUpperCase(), '8A406F2CA93B6BCC')
  assert.equal(pk.length, 32)
})
