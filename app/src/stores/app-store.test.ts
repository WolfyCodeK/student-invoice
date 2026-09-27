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

/** Loads the store fresh from `stored` (a string is stored exactly as given, e.g. damaged data). */
async function loadStore(stored: unknown = v101Data, otherKeys: Record<string, string> = {}) {
  vi.resetModules()
  localStorage.clear()
  for (const [key, value] of Object.entries(otherKeys)) localStorage.setItem(key, value)
  if (typeof stored === 'string') localStorage.setItem(STORE_KEY, stored)
  else if (stored) localStorage.setItem(STORE_KEY, JSON.stringify(stored))
  return import('./app-store')
}

const stored = () => JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')

/** Draft all's results as the register shows them: each family's status (and message). */
function results({ useAppStore }: Awaited<ReturnType<typeof loadStore>>) {
  const outcomes = useAppStore.getState().draftResults
  return outcomes && Object.fromEntries(Object.values(outcomes).map((o) => [o.templateId, o.message ? `${o.status}: ${o.message}` : o.status]))
}

/** The selected family's invoice, as the register's pupil page shows it. */
function selectedInvoice({ useAppStore, invoiceFor }: Awaited<ReturnType<typeof loadStore>>) {
  const s = useAppStore.getState()
  const template = s.templates.find((t) => t.id === s.currentTemplateId)
  return template ? invoiceFor(template, s.currentTerm, s.settings) : null
}

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
    const store = await loadStore()
    const s = store.useAppStore.getState()
    expect(s.templates).toEqual(v101Data.state.templates)
    expect(s.currentTemplateId).toBe('b2')
    expect(s.settings.customEmailBodyTemplate).toBe('Hi {{recipient}}')
    expect(selectedInvoice(store)?.subject).toBe('Invoice for Drum Lessons 1st half autumn term 2026')
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

  it('records no upgrade if the backup fails, and retries next time', async () => {
    const { useAppStore, migrateStoredData, CURRENT_DATA_REVISION } = await loadStore()
    backend.createAutoBackup.mockRejectedValueOnce({ kind: 'Internal', message: 'disk full' })
    await expect(migrateStoredData()).rejects.toBeTruthy()
    expect(useAppStore.getState().settings.dataRevision).toBeUndefined()
    await migrateStoredData()
    expect(useAppStore.getState().settings.dataRevision).toBe(CURRENT_DATA_REVISION)
  })

  it('clears the plaintext Google credentials even if the backup fails (backups never hold them)', async () => {
    const { useAppStore, migrateStoredData } = await loadStore()
    backend.createAutoBackup.mockRejectedValueOnce({ kind: 'Internal', message: 'disk full' })
    await expect(migrateStoredData()).rejects.toBeTruthy()
    expect(useAppStore.getState().settings.gmailClientSecret).toBe('')
    expect(stored().state.settings).toMatchObject({ gmailClientId: '', gmailClientSecret: '' })
  })

  it('clears them on every start, after going back to v1.0.1 and typing them in again', async () => {
    const downgraded = structuredClone(v101Data)
    Object.assign(downgraded.state.settings, { dataRevision: 1, gmailClientId: 'typed.apps.googleusercontent.com', gmailClientSecret: 'typed again' })
    const { useAppStore, migrateStoredData } = await loadStore(downgraded)
    await migrateStoredData()
    expect(backend.createAutoBackup).not.toHaveBeenCalled()
    expect(useAppStore.getState().settings).toMatchObject({ gmailClientId: '', gmailClientSecret: '' })
    // Kept as strings, the type v1.0.1 expects.
    expect(stored().state.settings).toMatchObject({ gmailClientId: '', gmailClientSecret: '' })
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
    const store = await loadStore()
    store.useAppStore.getState().updateTemplate('b2', { instrument: 'guitar' })
    expect(selectedInvoice(store)?.subject).toContain('Guitar')
  })

  it('updates after the email body changes (B6)', async () => {
    const store = await loadStore()
    store.useAppStore.getState().updateSettings({ customEmailBodyTemplate: 'Dear {{recipient}}' })
    expect(selectedInvoice(store)?.body).toBe('Dear Jo Parent')
  })

  it('clears when the selected template is deleted (B35)', async () => {
    const store = await loadStore()
    store.useAppStore.getState().deleteTemplate('b2')
    expect(selectedInvoice(store)).toBeNull()
  })

  it('is empty for a template with an unusable lesson day instead of hanging (B5)', async () => {
    const bad = structuredClone(v101Data)
    bad.state.templates[1].day = 'thursday'
    const store = await loadStore(bad)
    expect(selectedInvoice(store)).toBeNull()
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
  /** v1.0.1 data with a third family (Friday), so a run has something after a problem. */
  const threeFamilies = structuredClone(v101Data)
  threeFamilies.state.templates.push({ ...v101Data.state.templates[0], id: 'c3', recipient: 'Lou Parent', day: 'Friday', instrument: 'guitar' })

  it('creates one draft per template', async () => {
    const store = await loadStore()
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({ a1: 'saved', b2: 'saved' })
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(2)
    expect(store.useAppStore.getState().drafting).toBe(false)
  })

  it('stops at the first connection problem and reports the rest as not tried', async () => {
    const store = await loadStore()
    backend.gmailCreateDraft.mockRejectedValue({ kind: 'ReauthRequired', message: 'Please reconnect Gmail.' })
    backend.gmailStatus.mockClear()
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({
      a1: 'failed: Please reconnect Gmail.',
      b2: 'skipped: Not tried: fix the Gmail connection, then draft the rest.',
    })
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(1)
    expect(backend.gmailStatus).toHaveBeenCalled() // so the register offers Connect Gmail
    expect(store.useAppStore.getState().drafting).toBe(false)
  })

  it('stops early when Google cannot be reached, and a family with nothing to invoice still says so', async () => {
    const store = await loadStore(threeFamilies)
    const { useAppStore } = store
    const { lessonDates, lessonDateKey } = await import('../utils/invoice-generator')
    for (const d of lessonDates({ day: 'Thursday' }, useAppStore.getState().currentTerm!)) useAppStore.getState().toggleLesson('b2', lessonDateKey(d))
    backend.gmailCreateDraft.mockRejectedValue({ kind: 'Network', message: "Couldn't reach Google: couldn't connect" })
    await useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({
      a1: "failed: Couldn't reach Google: couldn't connect",
      b2: 'nothing',
      c3: "skipped: Not tried: Google couldn't be reached. Check your internet connection, then draft the rest.",
    })
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(1)
  })

  it('drafts each family as it is when its turn comes, not as it was when the run started', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().updateSettings({ customEmailBodyTemplate: '{{recipient}}: £{{totalCost}}' })
    backend.gmailCreateDraft.mockImplementation(async () => {
      // While the first draft is being saved, a lesson is unticked for the second family.
      if (backend.gmailCreateDraft.mock.calls.length === 1) useAppStore.getState().toggleLesson('b2', '2026-09-17')
      return { id: 'd' }
    })
    await useAppStore.getState().createAllInvoiceDrafts()
    expect(backend.gmailCreateDraft.mock.calls.map(([, body]) => body)).toEqual(['Alex Parent: £160.00', 'Jo Parent: £87.50'])
  })

  it('leaves out a family deleted during the run', async () => {
    const store = await loadStore()
    backend.gmailCreateDraft.mockImplementation(async () => {
      store.useAppStore.getState().deleteTemplate('b2')
      return { id: 'd' }
    })
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(1)
    expect(results(store)).toEqual({ a1: 'saved' })
  })

  it('keeps the results in the store until they are closed, and never saves them', async () => {
    const store = await loadStore()
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({ a1: 'saved', b2: 'saved' })
    expect(Object.keys(stored().state).sort()).toEqual(['currentTemplateId', 'gmailConnected', 'settings', 'templates'])
    store.useAppStore.getState().closeDraftResults()
    expect(store.useAppStore.getState().draftResults).toBeNull()
  })

  it('drafts only the families not saved yet when asked for the remaining ones', async () => {
    const store = await loadStore(threeFamilies)
    backend.gmailCreateDraft.mockResolvedValueOnce({ id: 'd' }).mockRejectedValueOnce({ kind: 'ReauthRequired', message: 'Please reconnect Gmail.' })
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toMatchObject({ a1: 'saved', b2: 'failed: Please reconnect Gmail.' })
    expect(results(store)?.c3).toMatch(/^skipped/)

    backend.gmailCreateDraft.mockReset()
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await store.useAppStore.getState().createAllInvoiceDrafts({ remainingOnly: true })
    expect(backend.gmailCreateDraft.mock.calls.map(([subject]) => subject)).toEqual([
      'Invoice for Drum Lessons 1st half autumn term 2026',
      'Invoice for Guitar Lessons 1st half autumn term 2026',
    ])
    expect(results(store)).toEqual({ a1: 'saved', b2: 'saved', c3: 'saved' })
  })

  it('records "Try again" in the results', async () => {
    const store = await loadStore()
    backend.gmailCreateDraft.mockResolvedValueOnce({ id: 'd' }).mockRejectedValueOnce({ kind: 'Google', message: 'Google returned an error: busy' })
    await store.useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({ a1: 'saved', b2: 'failed: Google returned an error: busy' })
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await store.useAppStore.getState().draftTemplate('b2')
    expect(results(store)).toEqual({ a1: 'saved', b2: 'saved' })
  })

  it('a single draft from the pupil page shows no results', async () => {
    const { useAppStore } = await loadStore()
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await useAppStore.getState().draftTemplate('a1')
    expect(useAppStore.getState().draftResults).toBeNull()
  })
})

describe('deleting a family', () => {
  it('saves a pre-delete backup that still holds the family, then deletes it', async () => {
    const { useAppStore } = await loadStore()
    const steps: string[] = []
    backend.createAutoBackup.mockImplementation(async (reason: string, content: string) => {
      steps.push(`backup ${reason}: ${JSON.parse(content).data.store.templates.map((t: { id: string }) => t.id).join(',')}`)
      return { name: 'x', reason, createdAt: '', size: 1 }
    })
    await useAppStore.getState().deleteFamily('b2', () => steps.push('before delete'))
    expect(steps).toEqual(['backup pre-delete: a1,b2', 'before delete'])
    expect(useAppStore.getState().templates.map((t) => t.id)).toEqual(['a1'])
  })

  it('deletes nothing if the backup fails', async () => {
    const { useAppStore } = await loadStore()
    backend.createAutoBackup.mockRejectedValueOnce({ kind: 'Internal', message: 'disk full' })
    const beforeDelete = vi.fn()
    await expect(useAppStore.getState().deleteFamily('b2', beforeDelete)).rejects.toBeTruthy()
    expect(beforeDelete).not.toHaveBeenCalled()
    expect(useAppStore.getState().templates.map((t) => t.id)).toEqual(['a1', 'b2'])
  })
})

describe('stored data that cannot be read', () => {
  const damaged = '{"state":{"templates":[{"id":"a1","recipient":"Alex'
  const copies = (key: string) => {
    const found: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith(key)) found[k] = localStorage.getItem(k)
    }
    return found
  }

  it('is copied aside before anything is written, then the app starts empty and says so once', async () => {
    const { useAppStore, takeStartupDataProblem, UNREADABLE_STORE_KEY } = await loadStore(damaged)
    expect(useAppStore.getState().templates).toEqual([])
    expect(localStorage.getItem(UNREADABLE_STORE_KEY)).toBe(damaged)
    // The start-up Gmail status is the first write: the copy is already safe.
    await vi.waitFor(() => expect(useAppStore.getState().gmail).not.toBeNull())
    expect(stored().state.templates).toEqual([])
    expect(localStorage.getItem(UNREADABLE_STORE_KEY)).toBe(damaged)
    expect(takeStartupDataProblem()).toBe('kept')
    expect(takeStartupDataProblem()).toBeNull()
  })

  it('never overwrites an earlier copy', async () => {
    const { UNREADABLE_STORE_KEY } = await loadStore(damaged, { 'student-invoice-store-unreadable': 'an earlier copy' })
    const kept = copies(UNREADABLE_STORE_KEY)
    expect(kept[UNREADABLE_STORE_KEY]).toBe('an earlier copy')
    expect(Object.values(kept).sort()).toEqual(['an earlier copy', damaged].sort())
  })

  it('keeps data stored under another persist version instead of discarding it', async () => {
    const { useAppStore, takeStartupDataProblem, UNREADABLE_STORE_KEY } = await loadStore({ ...v101Data, version: 3 })
    expect(useAppStore.getState().templates).toEqual([])
    expect(JSON.parse(localStorage.getItem(UNREADABLE_STORE_KEY)!).state.templates).toHaveLength(2)
    expect(takeStartupDataProblem()).toBe('kept')
  })

  it('is left where it is, and nothing is saved, if there is no room for a copy', async () => {
    const setItem = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('student-invoice-store-unreadable')) throw new DOMException('Full', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    try {
      const { useAppStore, takeStartupDataProblem } = await loadStore(damaged)
      useAppStore.getState().updateSettings({ yourName: 'Jo Teacher' })
      expect(localStorage.getItem(STORE_KEY)).toBe(damaged)
      expect(takeStartupDataProblem()).toBe('not-kept')
    } finally {
      spy.mockRestore()
    }
  })

  it('does not affect a normal start', async () => {
    const { useAppStore, takeStartupDataProblem, UNREADABLE_STORE_KEY } = await loadStore()
    useAppStore.getState().updateTemplate('a1', { cost: 25 })
    expect(stored().state.templates[0].cost).toBe(25)
    expect(takeStartupDataProblem()).toBeNull()
    expect(copies(UNREADABLE_STORE_KEY)).toEqual({})
  })
})

describe('Your name signs the emails (docs/proposals/2026-09-your-name-sign-off.md)', () => {
  /** v1.0.1 data using the standard wording (no custom email body). */
  const standardWording = {
    ...v101Data,
    state: { ...v101Data.state, settings: { ...v101Data.state.settings, customEmailBodyTemplate: undefined } },
  }

  it('is empty on a new install, so the standard wording needs it', async () => {
    const { useAppStore, needsYourName } = await loadStore(null)
    expect(useAppStore.getState().settings.yourName).toBeUndefined()
    expect(needsYourName(useAppStore.getState().settings)).toBe(true)
  })

  it('is never filled in for data from v1.0.1: nothing is drafted until it is set, then emails are signed with it', async () => {
    const store = await loadStore(standardWording)
    const { useAppStore, YOUR_NAME_NEEDED } = store
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    expect(useAppStore.getState().settings.yourName).toBeUndefined()
    await expect(useAppStore.getState().createAllInvoiceDrafts()).rejects.toThrow(YOUR_NAME_NEEDED)
    expect(useAppStore.getState().draftResults).toBeNull()
    await expect(useAppStore.getState().draftTemplate('a1')).rejects.toThrow(YOUR_NAME_NEEDED)
    expect(backend.gmailCreateDraft).not.toHaveBeenCalled()

    useAppStore.getState().updateSettings({ yourName: '  Jo Teacher ' })
    expect(selectedInvoice(store)?.body.endsWith('Many thanks,\nJo Teacher')).toBe(true)
    await useAppStore.getState().draftTemplate('a1')
    expect(String(backend.gmailCreateDraft.mock.calls[0][1]).endsWith('Many thanks,\nJo Teacher')).toBe(true)
    expect(stored().state.settings.yourName).toBe('  Jo Teacher ')
  })

  it('is never asked for when saved custom wording does not use {{yourName}}', async () => {
    const { useAppStore, needsYourName } = await loadStore() // custom wording 'Hi {{recipient}}'
    expect(needsYourName(useAppStore.getState().settings)).toBe(false)
    expect(needsYourName({ customEmailBodyTemplate: 'Thanks, {{yourName}}' })).toBe(true)
    expect(needsYourName({ yourName: '   ' })).toBe(true)
  })
})

describe('unticking a lesson that did not happen (docs/proposals/2026-09-untick-lessons.md)', () => {
  it('takes the lesson off the invoice, is saved, and can be ticked again', async () => {
    const store = await loadStore()
    const { useAppStore } = store
    useAppStore.getState().setCurrentTemplate('a1') // Monday, £20
    expect(selectedInvoice(store)?.totalCost).toBe(160)
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    expect(selectedInvoice(store)?.lessonCount).toBe(7)
    expect(selectedInvoice(store)?.totalCost).toBe(140)
    expect(stored().state.templates[0].skippedLessonDates).toEqual(['2026-09-21'])
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    expect(selectedInvoice(store)?.totalCost).toBe(160)
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

  it('drops unticks for the old lesson day when the day changes, so changing it back charges every lesson again', async () => {
    const store = await loadStore()
    const { useAppStore } = store
    useAppStore.getState().setCurrentTemplate('a1') // Monday, £20
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    expect(selectedInvoice(store)?.lessonCount).toBe(7)
    useAppStore.getState().updateTemplate('a1', { day: 'Tuesday' })
    expect(selectedInvoice(store)?.lessonCount).toBe(8)
    expect(stored().state.templates[0].skippedLessonDates).toEqual([])
    useAppStore.getState().updateTemplate('a1', { day: 'Monday' })
    expect(selectedInvoice(store)?.lessonCount).toBe(8)
    expect(selectedInvoice(store)?.totalCost).toBe(160)
  })

  it('keeps unticks when a family is saved with the same lesson day', async () => {
    const store = await loadStore()
    const { useAppStore } = store
    useAppStore.getState().setCurrentTemplate('a1')
    useAppStore.getState().toggleLesson('a1', '2026-09-21')
    // What the family editor saves: all five fields, the day unchanged.
    useAppStore.getState().updateTemplate('a1', { recipient: 'Alex P', students: 'Sam', instrument: 'piano', day: 'Monday', cost: 20 })
    expect(selectedInvoice(store)?.lessonCount).toBe(7)
    expect(stored().state.templates[0].skippedLessonDates).toEqual(['2026-09-21'])
  })

  it('does not add unticks to a family that never had any when its day changes', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().updateTemplate('a1', { day: 'Tuesday' })
    expect(stored().state.templates[0]).not.toHaveProperty('skippedLessonDates')
  })

  it('Draft all skips a family with every lesson unticked and says so', async () => {
    const store = await loadStore()
    const { useAppStore } = store
    const { lessonDates, lessonDateKey } = await import('../utils/invoice-generator')
    const term = useAppStore.getState().currentTerm!
    for (const d of lessonDates({ day: 'Thursday' }, term)) useAppStore.getState().toggleLesson('b2', lessonDateKey(d))
    backend.gmailCreateDraft.mockResolvedValue({ id: 'd' })
    await useAppStore.getState().createAllInvoiceDrafts()
    expect(results(store)).toEqual({ a1: 'saved', b2: 'nothing' })
    expect(backend.gmailCreateDraft).toHaveBeenCalledTimes(1)
    await expect(useAppStore.getState().draftTemplate('b2')).rejects.toThrow('nothing to invoice')
    expect(results(store)).toEqual({ a1: 'saved', b2: 'nothing' })
  })
})

describe('the Gmail status', () => {
  const status = { connected: false, email: null, configured: true, clientSource: 'builtIn' as const, connecting: false }

  it('is unknown until Rust answers, whatever the stored flag says (B22)', async () => {
    let answer: (value: typeof status) => void = () => {}
    backend.gmailStatus.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    const { useAppStore } = await loadStore() // v1.0.1 stored gmailConnected: true
    expect(useAppStore.getState().gmail).toBeNull()
    answer(status)
    await vi.waitFor(() => expect(useAppStore.getState().gmail?.connected).toBe(false))
    expect(stored().state.gmailConnected).toBe(false) // still written for v1.0.1
  })

  it('offers Connect Gmail if Rust cannot say', async () => {
    backend.gmailStatus.mockRejectedValueOnce({ kind: 'Storage', message: 'Credential Manager is unavailable' })
    const { useAppStore } = await loadStore()
    await vi.waitFor(() => expect(useAppStore.getState().gmail).toMatchObject({ connected: false, configured: true }))
  })

  it('shows a sign-in still waiting after the window reloaded as connecting, until it ends', async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 10, 12), toFake: ['Date', 'setTimeout'] })
    backend.gmailStatus
      .mockResolvedValueOnce({ ...status, connecting: true })
      .mockResolvedValueOnce({ ...status, connecting: true })
      .mockResolvedValueOnce({ ...status, connected: true, email: 'teacher@example.com' })
    const { useAppStore } = await loadStore()
    await vi.waitFor(() => expect(useAppStore.getState().gmailConnecting).toBe(true))
    await vi.advanceTimersByTimeAsync(1000)
    expect(useAppStore.getState().gmailConnecting).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(useAppStore.getState().gmailConnecting).toBe(false)
    expect(useAppStore.getState().gmail).toMatchObject({ connected: true, email: 'teacher@example.com' })
  })
})
