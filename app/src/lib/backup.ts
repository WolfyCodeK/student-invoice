// Building and reading backup files (export/import and automatic backups).
// Pure functions; the store and UI do the side effects. See docs/backup.md.
import type { AppSettings, InvoiceTemplate } from '../types'
import { BACKUP_FORMAT_VERSION, backupFileSchema, type BackupFile } from './schema'

export interface BackupSource {
  templates: InvoiceTemplate[]
  currentTemplateId: string | null
  settings: AppSettings
  theme: 'light' | 'dark' | null
}

const toIso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : undefined)

/** The JSON text of a backup of `source`. Google credentials are never included. */
export function buildBackup(source: BackupSource, appVersion: string, now = new Date()): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gmailClientId, gmailClientSecret, ...settings } = source.settings
  const file = {
    app: 'student-invoice',
    kind: 'backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    data: {
      store: {
        templates: source.templates.map((t) => ({ ...t, createdAt: toIso(t.createdAt), updatedAt: toIso(t.updatedAt) })),
        currentTemplateId: source.currentTemplateId,
        settings,
      },
      ...(source.theme ? { theme: source.theme } : {}),
    },
  }
  return JSON.stringify(file, null, 2)
}

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

/** A short description for the import confirmation. */
export function describeBackup(backup: BackupFile): { templates: number; exportedAt: Date; appVersion: string } {
  return {
    templates: backup.data.store.templates.length,
    exportedAt: new Date(backup.exportedAt),
    appVersion: backup.appVersion,
  }
}

/** File name offered when exporting, e.g. `Student Invoice backup 2026-09-26.json`. */
export function suggestedBackupName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Student Invoice backup ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}
