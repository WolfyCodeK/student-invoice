// The updater signing key (myapp.key): checking its password and changing it.
// Node built-ins only. See docs/release.md ("The signing key password").
//
// A Tauri key file is base64 of a minisign secret key:
//   "untrusted comment: ...\n<base64 box>\n"
// The box layout, the XOR encryption and the scrypt parameters follow the
// `minisign` crate that Tauri's signer uses (minisign 0.10: src/secret_key.rs,
// src/helpers.rs). Changing the password re-encrypts the same key, so the
// public key, which installed copies trust, never changes.
import { createHash, createPublicKey, randomBytes, scryptSync, verify } from 'node:crypto'
import { UPDATER_PUBKEY } from '../invariants.config.mjs'

// sig_alg(2) kdf_alg(2) chk_alg(2) salt(32) opslimit(8) memlimit(8), then
// the encrypted part: keynum(8) secret key(64) checksum(32).
const SALT = 6
const OPSLIMIT = 38
const MEMLIMIT = 46
const SECRET = 54
const SECRET_LEN = 8 + 64 + 32
const BOX_LEN = SECRET + SECRET_LEN
const N_LOG2_MAX = 20n
const MEMLIMIT_MAX = 1_073_741_824n

const decodeLines = (base64Text) => Buffer.from(base64Text.trim(), 'base64').toString('utf8').split('\n')
const xor = (a, b) => Buffer.from(a.map((byte, i) => byte ^ b[i]))

function readKeyFile(keyFileText) {
  const [comment, encoded] = decodeLines(keyFileText)
  const box = Buffer.from(encoded ?? '', 'base64')
  if (!comment?.startsWith('untrusted comment:') || box.length !== BOX_LEN || box.toString('latin1', 2, 4) !== 'Sc') {
    throw new Error('not a password-protected Tauri signing key')
  }
  return { comment, box }
}

/** The key id and Ed25519 public key from a Tauri public key string (as in tauri.conf.json). */
export function readPublicKey(pubkey = UPDATER_PUBKEY) {
  const raw = Buffer.from(decodeLines(pubkey)[1] ?? '', 'base64')
  if (raw.length !== 42) throw new Error('not a Tauri public key')
  return { keynum: raw.subarray(2, 10), pk: raw.subarray(10) }
}

/** minisign's raw_scrypt_params (libsodium's pickparams), in BigInt like the u64 original. */
export function scryptParams(opslimit, memlimit) {
  const ops = opslimit < 32768n ? 32768n : opslimit
  const r = 8n
  let nLog2 = 1n
  const pickN = (maxN) => {
    while (nLog2 < 63n && (1n << nLog2) <= maxN / 2n) nLog2++
  }
  let p = 1n
  if (ops < memlimit / 32n) {
    pickN(ops / (r * 4n))
  } else {
    pickN(memlimit / (r * 128n))
    const maxrp = ((ops / 4n) / (1n << nLog2)) & 0xffffffffn
    p = (maxrp < 0x3fffffffn ? maxrp : 0x3fffffffn) / r
  }
  if (nLog2 > N_LOG2_MAX) throw new Error('scrypt parameters too high')
  return { N: 2 ** Number(nLog2), r: Number(r), p: Number(p) }
}

function keystream(password, box) {
  const memlimit = box.readBigUInt64LE(MEMLIMIT)
  if (memlimit > MEMLIMIT_MAX) throw new Error('scrypt parameters too high')
  const { N, r, p } = scryptParams(box.readBigUInt64LE(OPSLIMIT), memlimit)
  const salt = box.subarray(SALT, SALT + 32)
  return scryptSync(Buffer.from(password, 'utf8'), salt, SECRET_LEN, { N, r, p, maxmem: 256 * N * r * (p + 1) })
}

/**
 * Decrypts the key with `password` and checks it against the public key that
 * installed copies trust. Throws if the password is wrong. (Node has no
 * BLAKE2b-256 for minisign's checksum; matching the key id and the public
 * half of the Ed25519 key is the stronger check anyway.)
 */
export function unlock(keyFileText, password, pubkey = UPDATER_PUBKEY) {
  const { box } = readKeyFile(keyFileText)
  const plain = xor(box.subarray(SECRET), keystream(password, box))
  const trusted = readPublicKey(pubkey)
  // An Ed25519 secret key is its 32-byte seed followed by the public key.
  if (!plain.subarray(0, 8).equals(trusted.keynum) || !plain.subarray(8 + 32, 8 + 64).equals(trusted.pk)) {
    throw new Error('wrong password for the updater signing key')
  }
  return plain
}

/** Encrypts `plain` (keynum, secret key, checksum) under `password` with a fresh salt. */
export function seal(plain, password, { comment, box }) {
  const out = Buffer.from(box)
  randomBytes(32).copy(out, SALT)
  xor(plain, keystream(password, out)).copy(out, SECRET)
  return Buffer.from(`${comment}\n${out.toString('base64')}\n`).toString('base64')
}

/** The same key, protected by `newPassword` instead. Throws if `oldPassword` is wrong. */
export function relock(keyFileText, oldPassword, newPassword, pubkey = UPDATER_PUBKEY) {
  const plain = unlock(keyFileText, oldPassword, pubkey)
  return seal(plain, newPassword, readKeyFile(keyFileText))
}

/**
 * Verifies a Tauri `.sig` for `data` against the trusted public key, the way
 * the updater does: the signature (over the BLAKE2b-512 hash for prehashed
 * "ED" signatures) and the global signature over the trusted comment.
 */
export function verifySignature(data, sigFileText, pubkey = UPDATER_PUBKEY) {
  const [, encoded, trustedLine, globalEncoded] = decodeLines(sigFileText)
  const sigBox = Buffer.from(encoded ?? '', 'base64')
  const trusted = readPublicKey(pubkey)
  if (sigBox.length !== 74 || !trustedLine?.startsWith('trusted comment: ')) return false
  if (!sigBox.subarray(2, 10).equals(trusted.keynum)) return false
  const alg = sigBox.toString('latin1', 0, 2)
  const message = alg === 'ED' ? createHash('blake2b512').update(data).digest() : data
  const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: trusted.pk.toString('base64url') }, format: 'jwk' })
  const signature = sigBox.subarray(10)
  const comment = Buffer.from(trustedLine.slice('trusted comment: '.length))
  return (
    verify(null, message, key, signature) &&
    verify(null, Buffer.concat([signature, comment]), key, Buffer.from(globalEncoded ?? '', 'base64'))
  )
}
