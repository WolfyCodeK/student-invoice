import { describe, expect, it } from 'vitest'
import { buildBackup, suggestedBackupName, type BackupSource } from './backup'
import { parseBackup } from './backup-parse'
import { MAX_LENGTH } from './schema/constants'
import type { AppSettings, InvoiceTemplate } from '../types'

const settings: AppSettings = {
  theme: 'light',
  emailMode: 'clipboard',
  windowPosition: { x: 100, y: 100 },
  gmailClientId: '123.apps.googleusercontent.com',
  gmailClientSecret: 'fake secret value',
  autoSave: true,
  showNotifications: true,
  customEmailBodyTemplate: 'Hi {{recipient}}, £{{totalCost}}',
}

const template = (over: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({
  id: 't1',
  recipient: "Zoë O'Brien",
  cost: 22.5,
  instrument: 'bass guitar',
  day: 'Thursday',
  students: 'Sam "the drummer" & Jo $&',
  createdAt: new Date('2025-01-02T03:04:05Z'),
  updatedAt: new Date('2025-06-07T08:09:10Z'),
  ...over,
})

const source: BackupSource = { templates: [template(), template({ id: 't2', day: 'Monday' })], currentTemplateId: 't2', settings, theme: 'dark' }

describe('backup files', () => {
  it('round-trips all user data exactly', () => {
    const text = buildBackup(source, '1.1.0', new Date('2026-09-26T12:00:00Z'))
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const { store, theme } = parsed.backup.data
    expect(theme).toBe('dark')
    expect(store.currentTemplateId).toBe('t2')
    expect(store.templates).toEqual([
      { ...template(), createdAt: '2025-01-02T03:04:05.000Z', updatedAt: '2025-06-07T08:09:10.000Z' },
      { ...template({ id: 't2', day: 'Monday' }), createdAt: '2025-01-02T03:04:05.000Z', updatedAt: '2025-06-07T08:09:10.000Z' },
    ])
    expect(store.settings.customEmailBodyTemplate).toBe(settings.customEmailBodyTemplate)
  })

  it('never includes Google credentials', () => {
    const text = buildBackup(source, '1.1.0')
    expect(text).not.toContain('fake secret value')
    expect(text).not.toContain('gmailClient')
  })

  it('keeps string dates from reloaded data', () => {
    const reloaded = { ...template(), createdAt: '2025-01-02T03:04:05.000Z' } as unknown as InvoiceTemplate
    const parsed = parseBackup(buildBackup({ ...source, templates: [reloaded] }, '1.1.0'))
    expect(parsed.ok && parsed.backup.data.store.templates[0].createdAt).toBe('2025-01-02T03:04:05.000Z')
  })

  it('imports every field at the longest the editors let you type (so every export imports again)', () => {
    const longest = (ch: string, n: number) => ch.repeat(n)
    const full = {
      ...source,
      templates: [template({ recipient: longest('r', MAX_LENGTH.recipient), students: longest('s', MAX_LENGTH.students) })],
      settings: { ...settings, customEmailBodyTemplate: longest('w', MAX_LENGTH.emailWording), yourName: longest('n', MAX_LENGTH.yourName) },
    }
    expect(parseBackup(buildBackup(full, '1.1.0')).ok).toBe(true)
    for (const over of [
      { templates: [template({ recipient: longest('r', MAX_LENGTH.recipient + 1) })] },
      { templates: [template({ students: longest('s', MAX_LENGTH.students + 1) })] },
      { settings: { ...settings, customEmailBodyTemplate: longest('w', MAX_LENGTH.emailWording + 1) } },
      { settings: { ...settings, yourName: longest('n', MAX_LENGTH.yourName + 1) } },
    ]) {
      expect(parseBackup(buildBackup({ ...source, ...over }, '1.1.0')).ok).toBe(false)
    }
  })

  it('accepts a byte-order mark', () => {
    expect(parseBackup('\uFEFF' + buildBackup(source, '1.1.0')).ok).toBe(true)
  })
})

describe('rejects hostile or broken files', () => {
  const valid = () => JSON.parse(buildBackup(source, '1.1.0'))

  it('not JSON / wrong app', () => {
    expect(parseBackup('hello').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ ...valid(), app: 'other' })).ok).toBe(false)
  })

  it('newer format version gives a clear message', () => {
    const r = parseBackup(JSON.stringify({ ...valid(), formatVersion: 2 }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/newer version/)
  })

  it('strips prototype-pollution keys and does not pollute', () => {
    const text = buildBackup(source, '1.1.0').replace('"theme": "dark"', '"theme": "dark", "__proto__": { "polluted": true }')
    const r = parseBackup(text)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(r.ok).toBe(true)
  })

  it('invalid weekday (would loop forever in the invoice generator)', () => {
    const f = valid()
    f.data.store.templates[0].day = 'monday'
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false)
  })

  it('non-finite, negative or string costs', () => {
    for (const cost of [-1, '20', null]) {
      const f = valid()
      f.data.store.templates[0].cost = cost
      expect(parseBackup(JSON.stringify(f)).ok).toBe(false)
    }
  })

  it('duplicate ids', () => {
    const f = valid()
    f.data.store.templates[1].id = f.data.store.templates[0].id
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false)
  })

  it('unexpected top-level fields', () => {
    expect(parseBackup(JSON.stringify({ ...valid(), extra: 1 })).ok).toBe(false)
  })

  it('oversized text', () => {
    const f = valid()
    f.data.store.templates[0].recipient = 'x'.repeat(5_001)
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false)
  })
})

describe('suggestedBackupName', () => {
  it('uses the local date', () => {
    expect(suggestedBackupName(new Date(2026, 8, 6, 23, 30))).toBe('Student Invoice backup 2026-09-06.json')
  })
})
