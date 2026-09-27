import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type { InvoiceTemplate, AppSettings, TermData } from '../types'
import { generateInvoice, getDefaultTemplateString, lessonDateKey, lessonDates, type InvoiceData } from '../utils/invoice-generator'
import { calculateTermData } from '../utils/terms'
import { backend, getAppVersion, isBackendError, errorMessage, type BackendError, type BackupReason, type GmailStatus } from '../lib/backend'
import { buildBackup, suggestedBackupName } from '../lib/backup'
import type { BackupFile } from '../lib/schema'
import { isWeekday } from '../lib/schema/constants'
import { applyAppearance, appearanceFrom, saveMode, storedMode, type Appearance } from '../lib/appearance'

/** What happened to one family during "Draft all" (for the register's status column). */
export interface DraftOutcome {
  templateId: string
  status: 'saving' | 'saved' | 'failed' | 'nothing' | 'skipped'
  message?: string
}

/** Draft all's results, by family id. Kept until the results are closed; never saved to storage. */
export type DraftResults = Record<string, DraftOutcome>

const NOTHING_TO_INVOICE = 'Every lesson is unticked for this family, so there is nothing to invoice.'
export const YOUR_NAME_NEEDED = 'Add your name first, so your emails are signed. It goes at the end of every email.'
const BAD_LESSON_DAY = 'The lesson day is not set correctly. Edit the family and choose a day.'
const NOT_TRIED_CONNECTION = 'Not tried: fix the Gmail connection, then draft the rest.'
const NOT_TRIED_NETWORK = "Not tried: Google couldn't be reached. Check your internet connection, then draft the rest."
const NOT_TRIED_NAME = 'Not tried: add your name first, then draft the rest.'

/** Errors after which no other draft can work until Gmail is connected again. */
const CONNECTION_PROBLEMS: BackendError['kind'][] = ['ReauthRequired', 'NotConnected', 'NotConfigured']
const isConnectionProblem = (error: unknown) => isBackendError(error) && CONNECTION_PROBLEMS.includes(error.kind)

interface AppState {
  // Templates
  templates: InvoiceTemplate[]
  currentTemplateId: string | null
  addTemplate: (template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** Changing the lesson day drops unticks for the old day (docs/billing.md). */
  updateTemplate: (id: string, updates: Partial<InvoiceTemplate>) => void
  deleteTemplate: (id: string) => void
  /**
   * Saves a `pre-delete` automatic backup, then deletes the family. Nothing
   * is deleted if the backup fails. `beforeDelete` runs just before it goes.
   */
  deleteFamily: (id: string, beforeDelete?: () => void) => Promise<void>
  setCurrentTemplate: (id: string | null) => void
  /** Untick a lesson that didn't happen, or tick it again (docs/billing.md). */
  toggleLesson: (templateId: string, date: string) => void

  // Appearance (docs/ui.md)
  setAppearance: (update: Partial<Appearance>) => void
  markVersionSeen: (version: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void

  /**
   * The half-term today is in; null outside term time. Worked out at start-up
   * and again whenever the date may have moved on (refreshCurrentTerm).
   */
  currentTerm: TermData | null
  /** Works out today's half-term again; changes nothing if it's the same one. */
  refreshCurrentTerm: () => void

  // Gmail (tokens live in Rust / Windows Credential Manager, never here)
  gmailConnected: boolean // persisted only for v1.0.1 compatibility
  /** What Rust reports; null until it has been asked. */
  gmail: GmailStatus | null
  gmailConnecting: boolean
  drafting: boolean
  /** Draft all's results; null when none are showing. */
  draftResults: DraftResults | null
  refreshGmailStatus: () => Promise<void>
  connectGmail: () => Promise<GmailStatus>
  cancelGmailConnect: () => Promise<void>
  disconnectGmail: () => Promise<void>
  setCustomGmailClient: (clientId: string, clientSecret: string) => Promise<void>
  clearCustomGmailClient: () => Promise<void>
  /**
   * Saves every family's invoice as a draft, one at a time, recording each
   * family in `draftResults` as it goes. With `remainingOnly`, families
   * already saved in the results showing are left out, so none is drafted twice.
   */
  createAllInvoiceDrafts: (options?: { remainingOnly?: boolean }) => Promise<void>
  /** Save one family's invoice as a draft (the pupil's page, and "Try again" after Draft all). */
  draftTemplate: (templateId: string) => Promise<void>
  closeDraftResults: () => void

  // Updates
  installUpdate: () => Promise<void>

  // Data transfer and backups (docs/backup.md)
  exportData: () => Promise<string | null>
  replaceAllData: (backup: BackupFile, safetyBackup: 'pre-import' | 'pre-restore') => Promise<void>
  backupNow: (reason: BackupReason) => Promise<void>
}

const defaultSettings: AppSettings = {
  theme: 'light',
  emailMode: 'clipboard',
  windowPosition: { x: 100, y: 100 },
  gmailClientId: '',
  gmailClientSecret: '',
  autoSave: true,
  showNotifications: true,
  customEmailBodyTemplate: undefined
}

/** The settings an email's wording comes from. */
export type EmailWording = Pick<AppSettings, 'customEmailBodyTemplate' | 'yourName'>

/**
 * A family's invoice this half-term, exactly as the email says it (the
 * register's figures and every draft come from here). Null outside term time,
 * or when the lesson day isn't a weekday, which the invoice generator needs.
 */
export function invoiceFor(template: InvoiceTemplate, term: TermData | null, wording: EmailWording): InvoiceData | null {
  return term && isWeekday(template.day)
    ? generateInvoice(template, term, wording.customEmailBodyTemplate, wording.yourName?.trim() ?? '')
    : null
}

/**
 * True when the email wording signs with {{yourName}} but no name is set, so
 * nothing may be copied or drafted yet (docs/proposals/2026-09-your-name-sign-off.md).
 * Custom wording without the placeholder never needs one.
 */
export function needsYourName(wording: EmailWording): boolean {
  if (wording.yourName?.trim()) return false
  return (wording.customEmailBodyTemplate || getDefaultTemplateString()).includes('{{yourName}}')
}

/** This half-term's lesson dates ("yyyy-MM-dd") for a template; none outside term time or without a weekday. */
function lessonKeys(template: Pick<InvoiceTemplate, 'day'>, term: TermData | null): Set<string> {
  if (!term || !isWeekday(template.day)) return new Set()
  return new Set(lessonDates(template, term).map(lessonDateKey))
}

/** Why a family can't be drafted as it is now (as its Draft all outcome), or its invoice. */
function draftableInvoice(template: InvoiceTemplate, term: TermData | null, wording: EmailWording): InvoiceData | Omit<DraftOutcome, 'templateId'> {
  if (!isWeekday(template.day)) return { status: 'failed', message: BAD_LESSON_DAY }
  const invoice = invoiceFor(template, term, wording)
  if (!invoice) return { status: 'failed', message: 'There is no invoice to save for this family right now.' }
  if (invoice.lessonCount === 0) return { status: 'nothing' }
  return invoice
}

async function currentBackupText(): Promise<string> {
  const { templates, currentTemplateId, settings } = useAppStore.getState()
  return buildBackup({ templates, currentTemplateId, settings, theme: storedMode() }, await getAppVersion())
}

/**
 * Upgrades stored data written by older versions, after saving a
 * `pre-migration` backup of it. Additive only (docs/data-model.md): older
 * versions must still be able to read the result. Runs on every start; each
 * upgrade runs once per revision.
 */
export const CURRENT_DATA_REVISION = 1

export async function migrateStoredData(): Promise<void> {
  const { settings, templates, updateSettings } = useAppStore.getState()
  // v1.0.1 kept a Google client ID and secret in plaintext. This version uses
  // a built-in client (or one in Windows Credential Manager), so they are
  // cleared on every start: going back to v1.0.1 and typing them again there
  // would otherwise leave them stored. No backup is needed first (backups
  // never include them). The fields stay, as '', so v1.0.1 still loads the data.
  if (settings.gmailClientId || settings.gmailClientSecret) updateSettings({ gmailClientId: '', gmailClientSecret: '' })

  const revision = settings.dataRevision ?? 0
  if (revision >= CURRENT_DATA_REVISION) return
  // A fresh install has nothing worth backing up.
  const hasUserData = templates.length > 0 || Boolean(settings.customEmailBodyTemplate || settings.yourName || settings.termDates)
  // Nothing is changed unless the backup succeeded; it is retried next start.
  if (hasUserData) await useAppStore.getState().backupNow('pre-migration')
  // Revision 1 was clearing the Google credentials, now done above on every start.
  updateSettings({ dataRevision: CURRENT_DATA_REVISION })
}

/** Takes the daily automatic backup if there isn't one from today yet. */
export async function ensureDailyBackup(): Promise<void> {
  if (useAppStore.getState().templates.length === 0) return
  const today = new Date().toISOString().slice(0, 10)
  const backups = await backend.listBackups()
  if (!backups.some((b) => b.reason === 'daily' && b.createdAt.startsWith(today))) {
    await useAppStore.getState().backupNow('daily')
  }
}

// ---- Loading stored data safely (docs/data-model.md) ----------------------

const STORE_KEY = 'student-invoice-store'
/** Where stored data that couldn't be read is copied, so starting afresh never loses it. */
export const UNREADABLE_STORE_KEY = 'student-invoice-store-unreadable'

type StoredState = Pick<AppState, 'templates' | 'currentTemplateId' | 'settings' | 'gmailConnected'>

/** Nothing is written until the stored data has loaded, or has been copied aside because it couldn't be read. */
let storageWritable = false
/** Stored data couldn't be read at start-up: a copy was kept, or (no room) the original was left alone. */
let startupDataProblem: 'kept' | 'not-kept' | null = null

/** The start-up data problem, once (App tells the user about it). */
export function takeStartupDataProblem(): 'kept' | 'not-kept' | null {
  const problem = startupDataProblem
  startupDataProblem = null
  return problem
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The stored value, or null when it can't be used as the app's data. */
function readStored(raw: string): StorageValue<StoredState> | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value) || !isRecord(value.state)) return null
  // zustand discards data stored under another version, so keep a copy instead.
  if (value.version !== undefined && value.version !== 0) return null
  const { templates, settings } = value.state
  if (templates !== undefined && !Array.isArray(templates)) return null
  if (settings !== undefined && !isRecord(settings)) return null
  return value as unknown as StorageValue<StoredState>
}

/** Copies unreadable stored data to its own key (never over an earlier copy), then lets the app start afresh. */
function setAsideUnreadable(raw: string): void {
  try {
    const earlier = localStorage.getItem(UNREADABLE_STORE_KEY)
    if (earlier !== raw) localStorage.setItem(earlier === null ? UNREADABLE_STORE_KEY : `${UNREADABLE_STORE_KEY}-${Date.now()}`, raw)
    startupDataProblem = 'kept'
    storageWritable = true
  } catch {
    // No room for a copy: leave the original where it is and save nothing.
    startupDataProblem = 'not-kept'
  }
}

/** localStorage, but unreadable data is set aside instead of being overwritten by the defaults. */
const safeStorage: PersistStorage<StoredState> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name)
    if (raw === null || raw === 'null') return null
    const value = readStored(raw)
    if (value === null) setAsideUnreadable(raw)
    return value
  },
  setItem: (name, value) => {
    if (storageWritable) localStorage.setItem(name, JSON.stringify(value))
  },
  removeItem: (name) => localStorage.removeItem(name),
}

/** Stores the status Rust reported (`gmailConnected` is kept in step for v1.0.1). */
const setGmail = (gmail: GmailStatus) => useAppStore.setState({ gmail, gmailConnected: gmail.connected })

/** Records a family's Draft all outcome while results are showing. */
function record(outcome: DraftOutcome): void {
  const results = useAppStore.getState().draftResults
  if (results) useAppStore.setState({ draftResults: { ...results, [outcome.templateId]: outcome } })
}

/** How often a sign-in left waiting by a reload is checked on. */
const PENDING_SIGN_IN_POLL_MS = 1000

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Gmail
      gmailConnected: false,
      gmail: null,
      gmailConnecting: false,
      drafting: false,
      draftResults: null,

      refreshGmailStatus: async () => {
        try {
          const status = await backend.gmailStatus()
          setGmail(status)
          // A sign-in started before the window reloaded is still waiting in
          // Rust: show it (with Cancel) until it ends.
          if (status.connecting && !get().gmailConnecting) void followPendingSignIn()
        } catch (error) {
          console.error('Failed to read Gmail status:', errorMessage(error))
          // Never leave the app waiting on a status that won't come: offer Connect Gmail.
          if (get().gmail === null) set({ gmail: { connected: false, email: null, configured: true, clientSource: null, connecting: false } })
        }
      },

      connectGmail: async () => {
        set({ gmailConnecting: true })
        try {
          const gmail = await backend.gmailConnect()
          set({ gmail, gmailConnected: gmail.connected, gmailConnecting: false })
          return gmail
        } catch (error) {
          // Failed or cancelled: there is no new status, so ask for it.
          set({ gmailConnecting: false })
          await get().refreshGmailStatus()
          throw error
        }
      },

      cancelGmailConnect: async () => {
        await backend.gmailCancelConnect()
      },

      disconnectGmail: async () => {
        setGmail(await backend.gmailDisconnect())
      },

      setCustomGmailClient: async (clientId, clientSecret) => {
        setGmail(await backend.gmailSetCustomClient(clientId, clientSecret))
      },

      clearCustomGmailClient: async () => {
        setGmail(await backend.gmailClearCustomClient())
      },

      createAllInvoiceDrafts: async ({ remainingOnly = false } = {}) => {
        const { drafting, currentTerm, templates, settings, draftResults } = get()
        if (drafting) return
        if (!currentTerm) throw new Error('It is outside term time, so there are no invoices to create.')
        if (templates.length === 0) throw new Error('There are no templates yet.')
        if (needsYourName(settings)) throw new Error(YOUR_NAME_NEEDED)
        const kept: DraftResults = {}
        if (remainingOnly && draftResults) {
          for (const outcome of Object.values(draftResults)) if (outcome.status === 'saved') kept[outcome.templateId] = outcome
        }
        const ids = templates.map((t) => t.id).filter((id) => !kept[id])
        set({ drafting: true, draftResults: kept })
        // Once a problem means no other draft can work, the rest are listed as not tried.
        let stop: string | null = null
        try {
          for (const templateId of ids) {
            // Read again for each family, just before its draft: the register
            // and Settings stay usable during the run, so each draft matches
            // what they show at that moment. A family deleted meanwhile is left out.
            const { templates: now, currentTerm: term, settings: wording } = get()
            const template = now.find((t) => t.id === templateId)
            if (!template) continue
            const invoice = draftableInvoice(template, term, wording)
            if (!('subject' in invoice)) {
              record({ templateId, ...invoice })
              continue
            }
            if (!stop && needsYourName(wording)) stop = NOT_TRIED_NAME
            if (stop) {
              record({ templateId, status: 'skipped', message: stop })
              continue
            }
            record({ templateId, status: 'saving' })
            try {
              await backend.gmailCreateDraft(invoice.subject, invoice.body)
              record({ templateId, status: 'saved' })
            } catch (error) {
              record({ templateId, status: 'failed', message: errorMessage(error) })
              // Without a working connection every remaining draft would fail too.
              if (isConnectionProblem(error)) {
                stop = NOT_TRIED_CONNECTION
                await get().refreshGmailStatus()
              } else if (isBackendError(error) && error.kind === 'Network') {
                stop = NOT_TRIED_NETWORK
              }
            }
          }
        } finally {
          set({ drafting: false })
        }
      },

      draftTemplate: async (templateId) => {
        const { drafting, templates, currentTerm, settings } = get()
        if (drafting) return
        const template = templates.find((t) => t.id === templateId)
        const invoice = template && invoiceFor(template, currentTerm, settings)
        // Each problem is also shown in Draft all's results, if they are showing.
        const refuse = (message: string, outcome: Omit<DraftOutcome, 'templateId'> = { status: 'failed', message }) => {
          record({ templateId, ...outcome })
          throw new Error(message)
        }
        if (!invoice) return refuse('There is no invoice to save for this family right now.')
        if (needsYourName(settings)) return refuse(YOUR_NAME_NEEDED)
        if (invoice.lessonCount === 0) return refuse(NOTHING_TO_INVOICE, { status: 'nothing' })
        set({ drafting: true })
        record({ templateId, status: 'saving' })
        try {
          await backend.gmailCreateDraft(invoice.subject, invoice.body)
          record({ templateId, status: 'saved' })
        } catch (error) {
          record({ templateId, status: 'failed', message: errorMessage(error) })
          if (isConnectionProblem(error)) await get().refreshGmailStatus()
          throw error
        } finally {
          set({ drafting: false })
        }
      },

      closeDraftResults: () => {
        if (!get().drafting) set({ draftResults: null })
      },

      // Updates
      installUpdate: async () => {
        // Best effort: an update never touches data, so don't block it.
        await get().backupNow('pre-update').catch((e) => console.warn('Pre-update backup failed:', errorMessage(e)))
        await backend.installUpdate()
      },

      // Data transfer and backups
      exportData: async () => {
        return backend.exportBackup(await currentBackupText(), suggestedBackupName())
      },

      replaceAllData: async (backup, safetyBackup) => {
        // Never replace data without a copy of what is being replaced.
        await get().backupNow(safetyBackup)
        const { store, theme } = backup.data
        const templates = store.templates as unknown as InvoiceTemplate[]
        // The user chose to replace everything, including stored data that
        // couldn't be read (and couldn't be copied) at start-up.
        storageWritable = true
        set({
          templates,
          currentTemplateId: templates.some((t) => t.id === store.currentTemplateId) ? store.currentTemplateId : (templates[0]?.id ?? null),
          settings: { ...defaultSettings, ...(store.settings as Partial<AppSettings>), gmailClientId: '', gmailClientSecret: '' },
        })
        // Imported term dates change which half-term it is.
        set({ currentTerm: calculateTermData(new Date(), get().settings.termDates) })
        if (theme) saveMode(theme)
        // The caller reloads the app, but the old colours shouldn't show meanwhile.
        applyAppearance(appearanceFrom(get().settings))
      },

      backupNow: async (reason) => {
        await backend.createAutoBackup(reason, await currentBackupText())
      },

      // Templates
      templates: [],
      currentTemplateId: null,

      addTemplate: (templateData) => {
        const newTemplate: InvoiceTemplate = {
          ...templateData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
        set((state) => ({
          templates: [...state.templates, newTemplate],
          currentTemplateId: newTemplate.id
        }))
      },

      updateTemplate: (id, updates) => {
        const term = get().currentTerm
        set((state) => ({
          templates: state.templates.map((template) => {
            if (template.id !== id) return template
            const updated = { ...template, ...updates, updatedAt: new Date() }
            // Unticks belong to one lesson day: with a new day they no longer
            // match any lesson and are dropped (docs/proposals/2026-09-untick-lessons.md),
            // so changing the day back later doesn't bring them back.
            if (updates.day !== undefined && updates.day !== template.day && updated.skippedLessonDates) {
              const lessons = lessonKeys(updated, term)
              updated.skippedLessonDates = updated.skippedLessonDates.filter((d) => lessons.has(d))
            }
            return updated
          })
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter(template => template.id !== id),
          currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId
        }))
      },

      deleteFamily: async (id, beforeDelete) => {
        // The confirmation promises a backup keeps a copy: take it first.
        await get().backupNow('pre-delete')
        beforeDelete?.()
        get().deleteTemplate(id)
      },

      setCurrentTemplate: (id) => {
        set({ currentTemplateId: id })
      },

      toggleLesson: (templateId, date) => {
        const { currentTerm, templates } = get()
        const template = templates.find((t) => t.id === templateId)
        if (!template) return
        // Only this half-term's lesson dates are kept, so unticks from past
        // half-terms (or an old lesson day) are dropped here.
        const lessons = lessonKeys(template, currentTerm)
        if (!lessons.has(date)) return
        const skipped = new Set((template.skippedLessonDates ?? []).filter((d) => lessons.has(d)))
        if (skipped.has(date)) skipped.delete(date)
        else skipped.add(date)
        get().updateTemplate(templateId, { skippedLessonDates: [...skipped].sort() })
      },

      // Appearance: applied where it changes, here and in replaceAllData
      // (index.html applies the saved one at start-up).
      setAppearance: (update) => {
        const settings = { ...get().settings }
        if (update.mode) {
          saveMode(update.mode)
          settings.theme = update.mode
        }
        if (update.scheme) settings.colourScheme = update.scheme
        if (update.corners) settings.corners = update.corners
        set({ settings })
        applyAppearance(appearanceFrom(settings))
      },

      markVersionSeen: (version) => {
        set((state) => ({ settings: { ...state.settings, lastSeenVersion: version } }))
      },

      // Settings
      settings: defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({ settings: { ...state.settings, ...updates } }))
        // Edited term dates move the current half-term and its lessons.
        if ('termDates' in updates) set({ currentTerm: calculateTermData(new Date(), get().settings.termDates) })
      },

      // Terms
      currentTerm: calculateTermData(new Date()),
      refreshCurrentTerm: () => {
        const { currentTerm, settings } = get()
        const today = calculateTermData(new Date(), settings.termDates)
        const same =
          today === currentTerm ||
          (!!today && !!currentTerm &&
            today.weeksCount === currentTerm.weeksCount &&
            today.term.startDate.getTime() === currentTerm.term.startDate.getTime() &&
            today.term.endDate.getTime() === currentTerm.term.endDate.getTime())
        if (!same) set({ currentTerm: today })
      },
    }),
    {
      name: 'student-invoice-store', // never change (docs/compatibility.md, store-key); STORE_KEY above is the same
      storage: safeStorage,
      partialize: (state): StoredState => ({
        templates: state.templates,
        currentTemplateId: state.currentTemplateId,
        settings: state.settings,
        gmailConnected: state.gmailConnected
      }),
      // zustand's default merge is shallow, which would drop defaults for
      // settings added in newer versions. Merge settings one level deeper.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<AppState>
        const settings = { ...current.settings, ...(stored.settings ?? {}) }
        // The half-term follows any term dates edited in Settings.
        return { ...current, ...stored, settings, currentTerm: calculateTermData(new Date(), settings.termDates) }
      },
      // Loading is synchronous (localStorage), so this runs before anything
      // else can write. Only then may writes happen; if loading failed
      // part-way, what is stored is copied aside first.
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          if (startupDataProblem === null) storageWritable = true
          return
        }
        console.error('Stored data could not be loaded:', errorMessage(error))
        let raw: string | null = null
        try {
          raw = localStorage.getItem(STORE_KEY)
        } catch {
          // Can't even read it: then nothing can be written over it either.
        }
        if (raw === null) storageWritable = true
        else setAsideUnreadable(raw)
      },
    }
  )
)

/**
 * Follows a sign-in that Rust is still waiting for after the window reloaded
 * (F5 during sign-in), so the app shows "Connecting" with Cancel until it ends.
 */
async function followPendingSignIn(): Promise<void> {
  useAppStore.setState({ gmailConnecting: true })
  try {
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, PENDING_SIGN_IN_POLL_MS))
      const status = await backend.gmailStatus()
      if (!status.connecting) {
        setGmail(status)
        return
      }
    }
  } catch (error) {
    console.error('Failed to follow the Gmail sign-in:', errorMessage(error))
  } finally {
    useAppStore.setState({ gmailConnecting: false })
  }
}

// Ask Rust for the Gmail status as the app starts.
void useAppStore.getState().refreshGmailStatus()

// A new half-term can start while the app stays open, or while the PC sleeps
// through it (docs/proposals/2026-09-rules-review-decisions.md). Check again
// just after midnight and whenever the window comes back into view. No
// polling: one timer to the next midnight, and the window's own events.
function followTheDate(): void {
  const refresh = () => useAppStore.getState().refreshCurrentTerm()
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
  const atMidnight = () => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    window.setTimeout(() => {
      refresh()
      atMidnight()
    }, next.getTime() - now.getTime())
  }
  atMidnight()
}
if (typeof window !== 'undefined') followTheDate()
