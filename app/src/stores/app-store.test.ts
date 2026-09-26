// @vitest-environment jsdom
/**
 * Store behaviour that protects user data: loading v1.0.1 data, the stored
 * shape older versions depend on, migrations and imports only after a backup,
 * and the preview never showing a stale invoice. See docs/data-model.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  gmailStatus: vi.fn(),
  gmailConnect: vi.fn(),
  gmailCancelConnect: vi.fn(),
  gmailDisconnect: vi.fn(),
  gmailCreateDraft: vi.fn(),
  gmailSetCustomClient: vi.fn(),
  gmailClearCustomClient: vi.fn(),
  checkForUpdates: vi.fn(),
  installUpdate: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  createAutoBackup: vi.fn(),
  listBackups: vi.fn(),
  readBackup: vi.fn(),
  openBackupsFolder: vi.fn(),
}))

vi.mock('../lib/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/backend')>()),
  backend,
}))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: () => Promise.resolve('1.1.0') }))

const STORE_KEY = 'student-invoice-store'

/** Exactly what v1.0.1 writes (synthetic data, real shape). */
const v101Data = {
  state: {
    templates: [
      {
        id: 'a1',
        recipient: 'Alex Parent',
        cost: 20,
        instrument: 'piano',
        day: 'Monday',
        students: 'Sam',
        createdAt: '2025-10-06T10:00:00.000Z',
        updatedAt: '2025-10-06T10:00:00.000Z',
      },
      {
        id: 'b2',
        recipient: 'Jo Parent',
        cost: 12.5,
        instrument: 'drum',
        day: 'Thursday',
        students: 'Kim',
        createdAt: '2025-10-06T10:00:00.000Z',
        updatedAt: '2025-10-06T10:00:00.000Z',
      },
    ],
    currentTemplateId: 'b2',
    settings: {
      theme: 'light',
      emailMode: 'clipboard',
      windowPosition: { x: 100, y: 100 },
      gmailClientId: 'old.apps.googleusercontent.com',
      gmailClientSecret: 'old plaintext secret',
      autoSave: true,
      showNotifications: true,
      customEmailBodyTemplate: 'Hi {{recipient}}',
    },
    gmailConnected: true,
  },
  version: 0,
}

async function loadStore(stored: unknown = v101Data) {
  vi.resetModules()
  localStorage.clear()
  if (stored) localStorage.setItem(STORE_KEY, JSON.stringify(stored))
  return import('./app-store')
}

const stored = () => JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 10, 12), toFake: ['Date'] }) // in autumn ½ 2026
  for (const fn of Object.values(backend)) fn.mockReset()
  backend.gmailStatus.mockResolvedValue({ connected: false, email: null, configured: true, clientSource: 'builtIn', connecting: false })
  backend.createAutoBackup.mockResolvedValue({ name: 'x', reason: 'daily', createdAt: '', size: 1 })
  backend.listBackups.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('loading data written by v1.0.1', () => {
  it('keeps every template and setting', async () => {
    const { useAppStore } = await loadStore()
    const s = useAppStore.getState()
    expect(s.templates).toEqual(v101Data.state.templates)
    expect(s.currentTemplateId).toBe('b2')
    expect(s.settings.customEmailBodyTemplate).toBe('Hi {{recipient}}')
    expect(s.currentInvoice?.subject).toBe('Invoice for Drum Lessons 1st half autumn term 2026')
  })

  it('fills in settings that did not exist in older versions (deep merge)', async () => {
    const legacy = structuredClone(v101Data)
    delete (legacy.state.settings as Partial<typeof legacy.state.settings>).showNotifications
    const { useAppStore } = await loadStore(legacy)
    expect(useAppStore.getState().settings.showNotifications).toBe(true)
    expect(useAppStore.getState().settings.customEmailBodyTemplate).toBe('Hi {{recipient}}')
  })

  it('starts empty with no stored data', async () => {
    const { useAppStore } = await loadStore(null)
    expect(useAppStore.getState().templates).toEqual([])
  })
})

describe('what is written stays readable by v1.0.1', () => {
  it('uses persist version 0 and exactly the four keys v1.0.1 saves', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().updateTemplate('a1', { cost: 25 })
    const s = stored()
    expect(s.version).toBe(0)
    expect(Object.keys(s.state).sort()).toEqual(['currentTemplateId', 'gmailConnected', 'settings', 'templates'])
    expect(s.state.templates[0]).toMatchObject({ id: 'a1', cost: 25, day: 'Monday' })
    // Legacy fields keep their type (strings) so v1.0.1 still loads.
    expect(typeof s.state.settings.gmailClientSecret).toBe('string')
  })
})

describe('migrating older data', () => {
  it('backs up first, then clears the plaintext Google credentials', async () => {
    const { useAppStore, migrateStoredData, CURRENT_DATA_REVISION } = await loadStore()
    await migrateStoredData()
    expect(backend.createAutoBackup).toHaveBeenCalledWith('pre-migration', expect.any(String))
    const backup = JSON.parse(backend.createAutoBackup.mock.calls[0][1])
    expect(backup.data.store.templates).toHaveLength(2)
    const settings = useAppStore.getState().settings
    expect(settings.gmailClientId).toBe('')
    expect(settings.gmailClientSecret).toBe('')
    expect(settings.dataRevision).toBe(CURRENT_DATA_REVISION)
    expect(stored().state.settings.gmailClientSecret).toBe('')
  })

  it('changes nothing if the backup fails, and retries next time', async () => {
    const { useAppStore, migrateStoredData } = await loadStore()
    backend.createAutoBackup.mockRejectedValueOnce({ kind: 'Internal', message: 'disk full' })
    await expect(migrateStoredData()).rejects.toBeTruthy()
    expect(useAppStore.getState().settings.gmailClientSecret).toBe('old plaintext secret')
    await migrateStoredData()
    expect(useAppStore.getState().settings.gmailClientSecret).toBe('')
  })

  it('does not back up a fresh install (nothing to protect)', async () => {
    const { useAppStore, migrateStoredData, CURRENT_DATA_REVISION } = await loadStore(null)
    await migrateStoredData()
    expect(backend.createAutoBackup).not.toHaveBeenCalled()
    expect(useAppStore.getState().settings.dataRevision).toBe(CURRENT_DATA_REVISION)
  })

  it('runs only once', async () => {
    const { migrateStoredData } = await loadStore()
    await migrateStoredData()
    await migrateStoredData()
    expect(backend.createAutoBackup).toHaveBeenCalledTimes(1)
  })
})

describe('the preview never shows a stale invoice', () => {
  it('updates after the selected template is edited (B6)', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().updateTemplate('b2', { instrument: 'guitar' })
    expect(useAppStore.getState().currentInvoice?.subject).toContain('Guitar')
  })

  it('updates after the email body changes (B6)', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().updateSettings({ customEmailBodyTemplate: 'Dear {{recipient}}' })
    expect(useAppStore.getState().currentInvoice?.body).toBe('Dear Jo Parent')
  })

  it('clears when the selected template is deleted (B35)', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().deleteTemplate('b2')
    expect(useAppStore.getState().currentInvoice).toBeNull()
  })

  it('is empty for a template with an unusable lesson day instead of hanging (B5)', async () => {
    const bad = structuredClone(v101Data)
    bad.state.templates[1].day = 'thursday'
    const { useAppStore } = await loadStore(bad)
    expect(useAppStore.getState().currentInvoice).toBeNull()
  })
})

describe('replacing all data (import / restore)', () => {
  const backupFile = {
    app: 'student-invoice' as const,
    kind: 'backup' as const,
    formatVersion: 1,
    appVersion: '1.1.0',
    exportedAt: '2026-09-26T12:00:00.000Z',
    data: {
      store: {
        templates: [{ id: 'n1', recipient: 'New', cost: 30, instrument: 'vocal', day: 'Friday' as const, students: 'Lee' }],
        currentTemplateId: 'missing',
        settings: { customEmailBodyTemplate: 'Imported {{students}}' },
      },
      theme: 'dark' as const,
    },
  }

  it('saves a safety backup first, then replaces everything', async () => {
    const { useAppStore } = await loadStore()
    await useAppStore.getState().replaceAllData(backupFile, 'pre-import')
    expect(backend.createAutoBackup).toHaveBeenCalledWith('pre-import', expect.any(String))
    const s = useAppStore.getState()
    expect(s.templates.map((t) => t.id)).toEqual(['n1'])
    expect(s.currentTemplateId).toBe('n1') // unknown id falls back to the first template
    expect(s.settings.customEmailBodyTemplate).toBe('Imported {{students}}')
    expect(localStorage.getItem('student-invoice-theme')).toBe('dark')
  })

  it('replaces nothing if the safety backup fails', async () => {
    const { useAppStore } = await loadStore()
    backend.createAutoBackup.mockRejectedValueOnce({ kind: 'Internal', message: 'disk full' })
    await expect(useAppStore.getState().replaceAllData(backupFile, 'pre-import')).rejects.toBeTruthy()
    expect(useAppStore.getState().templates.map((t) => t.id)).toEqual(['a1', 'b2'])
  })
})

describe('Draft all', () => {
  it('stops at the first connection problem and reports the rest as skipped', async () => {
    const { useAppStore } = await loadStore()
    backend.gmailCreateDraft.mockRejectedValue({ kind: 'ReauthRequired', message: 'Please reconnect Gmail.' })
    const result = await useAppStore.getState().createAllInvoiceDrafts()
    expect(result).toEqual({ success: 0, failures: [{ label: 'Sam (Alex Parent)', message: 'Please reconnect Gmail.' }], skipped: 1, nothingToInvoice: [] })
    expect(useAppStore.getState().drafting).toBe(false)
  })

  it('creates one draft per template', async () => {
    const { useAppStore } = await loadStore()
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    const result = await useAppStore.getState().createAllInvoiceDrafts()
    expect(result.success).toBe(2)
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(2)
  })
})

describe('unticking a lesson that did not happen (docs/proposals/2026-09-untick-lessons.md)', () => {
  it('takes the lesson off the invoice, is saved, and can be ticked again', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().setCurrentTemplate('a1') // Monday, £20
    expect(useAppStore.getState().currentInvoice?.totalCost).toBe(160)
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    expect(useAppStore.getState().currentInvoice?.lessonCount).toBe(7)
    expect(useAppStore.getState().currentInvoice?.totalCost).toBe(140)
    expect(stored().state.templates[0].skippedLessonDates).toEqual(['2026-09-21'])
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    expect(useAppStore.getState().currentInvoice?.totalCost).toBe(160)
    expect(stored().state.templates[0].skippedLessonDates).toEqual([])
  })

  it('ignores dates that are not one of the lessons, and drops unticks from other half-terms', async () => {
    const data = structuredClone(v101Data) as typeof v101Data
    ;(data.state.templates[0] as Record<string, unknown>).skippedLessonDates = ['2026-06-01']
    const { useAppStore } = await loadStore(data)
    useAppStore.getState().toggleLesson('a1', '2026-09-22') // a Tuesday: not a lesson
    expect(stored().state.templates[0].skippedLessonDates).toEqual(['2026-06-01'])
    useAppStore.getState().toggleLesson('a1', '2026-10-26')
    expect(stored().state.templates[0].skippedLessonDates).toEqual(['2026-10-26'])
  })

  it('Draft all skips a family with every lesson unticked and names it', async () => {
    const { useAppStore } = await loadStore()
    const { lessonDates, lessonDateKey } = await import('../utils/invoice-generator')
    const term = useAppStore.getState().currentTerm!
    for (const d of lessonDates({ day: 'Thursday' }, term)) useAppStore.getState().toggleLesson('b2', lessonDateKey(d))
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    const result = await useAppStore.getState().createAllInvoiceDrafts()
    expect(result).toEqual({ success: 1, failures: [], skipped: 0, nothingToInvoice: ['Kim (Jo Parent)'] })
    await expect(useAppStore.getState().createCurrentInvoiceDraft()).rejects.toThrow('nothing to invoice')
  })
})
