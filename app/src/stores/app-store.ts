import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InvoiceTemplate, AppSettings, TermData } from '../types'
import { generateInvoice, lessonDateKey, lessonDates, type InvoiceData } from '../utils/invoice-generator'
import { calculateTermData } from '../utils/terms'
import { backend, getAppVersion, isBackendError, errorMessage, type BackupReason, type GmailStatus } from '../lib/backend'
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

const NOTHING_TO_INVOICE = 'Every lesson is unticked for this family, so there is nothing to invoice.'

interface AppState {
  // Templates
  templates: InvoiceTemplate[]
  currentTemplateId: string | null
  addTemplate: (template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTemplate: (id: string, updates: Partial<InvoiceTemplate>) => void
  deleteTemplate: (id: string) => void
  setCurrentTemplate: (id: string | null) => void
  /** Untick a lesson that didn't happen, or tick it again (docs/billing.md). */
  toggleLesson: (templateId: string, date: string) => void

  // Appearance (docs/ui.md)
  setAppearance: (update: Partial<Appearance>) => void
  markVersionSeen: (version: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void

  /** The half-term today is in, worked out once at start-up; null outside term time. */
  currentTerm: TermData | null

  // Gmail (tokens live in Rust / Windows Credential Manager, never here)
  gmailConnected: boolean // persisted only for v1.0.1 compatibility
  gmail: GmailStatus | null
  gmailConnecting: boolean
  drafting: boolean
  refreshGmailStatus: () => Promise<void>
  connectGmail: () => Promise<GmailStatus>
  cancelGmailConnect: () => Promise<void>
  disconnectGmail: () => Promise<void>
  setCustomGmailClient: (clientId: string, clientSecret: string) => Promise<void>
  clearCustomGmailClient: () => Promise<void>
  /** Saves every family's invoice as a draft, one at a time, reporting each family as it goes. */
  createAllInvoiceDrafts: (onProgress: (outcome: DraftOutcome) => void) => Promise<void>
  /** Save one family's invoice as a draft (the pupil's page, and "Try again" after Draft all). */
  draftTemplate: (templateId: string) => Promise<void>

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

/**
 * A family's invoice this half-term, exactly as the email says it (the
 * register's figures and every draft come from here). Null outside term time,
 * or when the lesson day isn't a weekday, which the invoice generator needs.
 */
export function invoiceFor(template: InvoiceTemplate, term: TermData | null, customBody?: string): InvoiceData | null {
  return term && isWeekday(template.day) ? generateInvoice(template, term, customBody) : null
}

async function currentBackupText(): Promise<string> {
  const { templates, currentTemplateId, settings } = useAppStore.getState()
  return buildBackup({ templates, currentTemplateId, settings, theme: storedMode() }, await getAppVersion())
}

/**
 * Upgrades stored data written by older versions, after saving a
 * `pre-migration` backup of it. Additive only (docs/data-model.md): older
 * versions must still be able to read the result. Runs once per revision.
 */
export const CURRENT_DATA_REVISION = 1

export async function migrateStoredData(): Promise<void> {
  const { settings, templates, updateSettings } = useAppStore.getState()
  const revision = settings.dataRevision ?? 0
  if (revision >= CURRENT_DATA_REVISION) return
  // A fresh install has nothing worth backing up.
  const hasUserData = templates.length > 0 || Boolean(settings.customEmailBodyTemplate) || Boolean(settings.gmailClientId || settings.gmailClientSecret)
  // Nothing is changed unless the backup succeeded; it is retried next start.
  if (hasUserData) await useAppStore.getState().backupNow('pre-migration')
  const updates: Partial<AppSettings> = { dataRevision: CURRENT_DATA_REVISION }
  if (revision < 1) {
    // v1.0.1 kept the Google client ID/secret in plaintext. v1.1.0 uses a
    // built-in client (or one in Windows Credential Manager). The fields stay
    // (as '') so older versions can still load the data.
    updates.gmailClientId = ''
    updates.gmailClientSecret = ''
  }
  updateSettings(updates)
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

/** Stores the status Rust reported (`gmailConnected` is kept in step for v1.0.1). */
const setGmail = (gmail: GmailStatus) => useAppStore.setState({ gmail, gmailConnected: gmail.connected })

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Gmail
      gmailConnected: false,
      gmail: null,
      gmailConnecting: false,
      drafting: false,

      refreshGmailStatus: async () => {
        try {
          setGmail(await backend.gmailStatus())
        } catch (error) {
          console.error('Failed to read Gmail status:', errorMessage(error))
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

      createAllInvoiceDrafts: async (onProgress) => {
        const { drafting, currentTerm: term, templates, settings } = get()
        if (drafting) return
        if (!term) throw new Error('It is outside term time, so there are no invoices to create.')
        if (templates.length === 0) throw new Error('There are no templates yet.')
        set({ drafting: true })
        try {
          for (const [i, template] of templates.entries()) {
            const templateId = template.id
            if (!isWeekday(template.day)) {
              onProgress({ templateId, status: 'failed', message: 'The lesson day is not set correctly. Edit the family and choose a day.' })
              continue
            }
            const invoice = generateInvoice(template, term, settings.customEmailBodyTemplate)
            if (invoice.lessonCount === 0) {
              onProgress({ templateId, status: 'nothing' })
              continue
            }
            onProgress({ templateId, status: 'saving' })
            try {
              await backend.gmailCreateDraft(invoice.subject, invoice.body)
              onProgress({ templateId, status: 'saved' })
            } catch (error) {
              onProgress({ templateId, status: 'failed', message: errorMessage(error) })
              // Without a working connection every remaining draft would fail too.
              if (isBackendError(error) && ['ReauthRequired', 'NotConnected', 'NotConfigured'].includes(error.kind)) {
                for (const rest of templates.slice(i + 1)) {
                  onProgress({ templateId: rest.id, status: 'skipped', message: 'Not tried: fix the Gmail connection, then try again.' })
                }
                await get().refreshGmailStatus()
                break
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
        const invoice = template && invoiceFor(template, currentTerm, settings.customEmailBodyTemplate)
        if (!invoice) throw new Error('There is no invoice to save for this family right now.')
        if (invoice.lessonCount === 0) throw new Error(NOTHING_TO_INVOICE)
        set({ drafting: true })
        try {
          await backend.gmailCreateDraft(invoice.subject, invoice.body)
        } catch (error) {
          if (isBackendError(error) && (error.kind === 'ReauthRequired' || error.kind === 'NotConnected')) {
            await get().refreshGmailStatus()
          }
          throw error
        } finally {
          set({ drafting: false })
        }
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
        set({
          templates,
          currentTemplateId: templates.some((t) => t.id === store.currentTemplateId) ? store.currentTemplateId : (templates[0]?.id ?? null),
          settings: { ...defaultSettings, ...(store.settings as Partial<AppSettings>), gmailClientId: '', gmailClientSecret: '' },
        })
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
        set((state) => ({
          templates: state.templates.map(template =>
            template.id === id
              ? { ...template, ...updates, updatedAt: new Date() }
              : template
          )
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter(template => template.id !== id),
          currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId
        }))
      },

      setCurrentTemplate: (id) => {
        set({ currentTemplateId: id })
      },

      toggleLesson: (templateId, date) => {
        const { currentTerm, templates } = get()
        const template = templates.find((t) => t.id === templateId)
        if (!currentTerm || !template || !isWeekday(template.day)) return
        // Only this half-term's lesson dates are kept, so unticks from past
        // half-terms (or an old lesson day) are dropped here.
        const lessons = new Set(lessonDates(template, currentTerm).map(lessonDateKey))
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
      },

      // Terms
      currentTerm: calculateTermData(new Date()),
    }),
    {
      name: 'student-invoice-store',
      partialize: (state) => ({
        templates: state.templates,
        currentTemplateId: state.currentTemplateId,
        settings: state.settings,
        gmailConnected: state.gmailConnected
      }),
      // zustand's default merge is shallow, which would drop defaults for
      // settings added in newer versions. Merge settings one level deeper.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<AppState>
        return { ...current, ...stored, settings: { ...current.settings, ...(stored.settings ?? {}) } }
      },
    }
  )
)

// Ask Rust for the Gmail status as the app starts.
void useAppStore.getState().refreshGmailStatus()
