// Reading backup files: strict validation with zod. Loaded on demand (import,
// restore) so zod isn't part of the start-up bundle. See docs/backup.md.
import { BACKUP_FORMAT_VERSION, backupFileSchema, type BackupFile } from './schema'

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string }

/** Keys that could modify object prototypes if the data were later merged. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Parses and validates a backup file's text. Never throws. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''), (key, value) => (UNSAFE_KEYS.has(key) ? undefined : value))
  } catch {
    return { ok: false, error: "This file isn't a Student Invoice backup." }
  }
  const version = (raw as { formatVersion?: unknown } | null)?.formatVersion
  if (typeof version === 'number' && version > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Student Invoice. Update the app, then try again.' }
  }
  const result = backupFileSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { ok: false, error: `This backup file is damaged or not a Student Invoice backup${where}.` }
  }
  return { ok: true, backup: result.data }
}
