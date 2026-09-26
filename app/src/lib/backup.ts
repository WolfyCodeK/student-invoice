// Building and reading backup files (export/import and automatic backups).
// Pure functions; the store and UI do the side effects. See docs/backup.md.
// Parsing (which needs zod) is in ./backup-parse.ts and loaded on demand.
import type { AppSettings, InvoiceTemplate } from '../types'
import { BACKUP_FORMAT_VERSION } from './schema/constants'
import type { BackupFile } from './schema'

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
