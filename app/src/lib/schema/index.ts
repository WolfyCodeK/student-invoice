// Single source of truth for the shape of stored data and backup files.
// Also imported by scripts/docs/generate.mjs (Node type-stripping), so this
// file must stay self-contained: only `zod` and `./constants.ts` imports
// (with the .ts extension), erasable TS syntax only.
import { z } from 'zod'
import { MAX_LENGTH, WEEKDAYS } from './constants.ts'

export { BACKUP_FORMAT_VERSION } from './constants.ts'

const text = (max: number) => z.string().max(max)

/**
 * A template as stored (lenient: unknown fields from newer versions are kept,
 * see docs/data-model.md). Used to read localStorage.
 */
const storedTemplateSchema = z.looseObject({
  id: z.string(),
  recipient: z.string(),
  cost: z.number(),
  instrument: z.string(),
  day: z.string(),
  students: z.string(),
  skippedLessonDates: z.array(z.string()).optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
})

const storedSettingsSchema = z.looseObject({
  theme: z.enum(['light', 'dark']).optional(),
  customEmailBodyTemplate: z.string().optional(),
  gmailClientId: z.string().optional(),
  gmailClientSecret: z.string().optional(),
})

/** What zustand persists under `student-invoice-store` (`state` part). */
export const persistedStateSchema = z.looseObject({
  templates: z.array(storedTemplateSchema),
  currentTemplateId: z.string().nullable(),
  settings: storedSettingsSchema,
  gmailConnected: z.boolean().optional(),
})

/**
 * A template inside an imported file: strictly validated, because the file
 * may come from anywhere. Unknown fields (from a newer version) are kept.
 * Length limits are generous, and the editors stop typing at the same ones
 * (MAX_LENGTH), so every export can be imported again.
 */
const backupTemplateSchema = z.looseObject({
  id: text(100).min(1),
  recipient: text(MAX_LENGTH.recipient),
  cost: z.number().finite().min(0),
  instrument: text(MAX_LENGTH.instrument),
  day: z.enum(WEEKDAYS),
  students: text(MAX_LENGTH.students),
  skippedLessonDates: z.array(z.iso.date()).max(500).optional(),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
})

/** Settings inside an imported file. Google credentials are never included. */
const backupSettingsSchema = z.looseObject({
  theme: z.enum(['light', 'dark']).optional(),
  customEmailBodyTemplate: text(MAX_LENGTH.emailWording).optional(),
  // Strings, not enums: a file from a newer version may name a newer choice.
  colourScheme: text(40).optional(),
  corners: text(40).optional(),
  lastSeenVersion: text(40).optional(),
  yourName: text(MAX_LENGTH.yourName).optional(),
  // Edited half-term dates: school-year start ("2026") → the six half-terms in order.
  termDates: z
    .record(z.string().regex(/^\d{4}$/), z.array(z.strictObject({ start: z.iso.date(), end: z.iso.date() })).length(6))
    .optional(),
})

/** The export file (`Student Invoice backup YYYY-MM-DD.json`). */
export const backupFileSchema = z.strictObject({
  app: z.literal('student-invoice'),
  kind: z.literal('backup'),
  formatVersion: z.number().int().min(1),
  appVersion: text(40),
  exportedAt: z.iso.datetime(),
  data: z.strictObject({
    store: z.strictObject({
      templates: z
        .array(backupTemplateSchema)
        .max(2000)
        .refine((ts) => new Set(ts.map((t) => t.id)).size === ts.length, 'Two templates have the same id'),
      currentTemplateId: text(100).nullable(),
      settings: backupSettingsSchema,
    }),
    theme: z.enum(['light', 'dark']).optional(),
  }),
})

export type BackupFile = z.infer<typeof backupFileSchema>
