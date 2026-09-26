import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InvoiceTemplate, AppSettings, TermData } from '../types'
import { generateInvoice, generateAllInvoices, InvoiceData, lessonDateKey, lessonDates } from '../utils/invoice-generator'
import { calculateTermData, getTermsForAcademicYear } from '../utils/terms'
import { backend, isBackendError, errorMessage, type BackupReason, type GmailStatus, type UpdateInfo } from '../lib/backend'
import { buildBackup, suggestedBackupName } from '../lib/backup'
import type { ParseResult } from '../lib/backup-parse'
import type { BackupFile } from '../lib/schema'
import { WEEKDAYS } from '../lib/schema/constants'
import { getVersion } from '@tauri-apps/api/app'
import { applyAppearance, appearanceFrom, saveMode, THEME_STORAGE_KEY, type Appearance } from '../lib/appearance'

/** One template's result from "Draft all". */
export interface DraftFailure {
  label: string
  message: string
}

/** What happened to one family during "Draft all" (for the register's status column). */
export interface DraftOutcome {
  templateId: string
  status: 'saving' | 'saved' | 'failed' | 'nothing' | 'skipped'
  message?: string
}

export interface DraftAllResult {
  outcomes: DraftOutcome[]
  success: number
  failures: DraftFailure[]
  /** Not attempted, because an earlier failure means every draft would fail. */
  skipped: number
  /** Families with every lesson unticked: there is nothing to invoice. */
  nothingToInvoice: string[]
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

  // Terms
  currentTerm: TermData | null
  calculateCurrentTerm: (date?: Date) => void

  // Invoice Generation
  currentInvoice: InvoiceData | null
  generateCurrentInvoice: () => void
  generateAllInvoicesAction: () => InvoiceData[]

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
  createCurrentInvoiceDraft: () => Promise<void>
  createAllInvoiceDrafts: (onProgress?: (outcome: DraftOutcome) => void) => Promise<DraftAllResult>
  /** Save one family's invoice as a draft ("Try again" after Draft all). */
  draftTemplate: (templateId: string) => Promise<void>

  // Updates
  checkForUpdates: () => Promise<UpdateInfo>
  installUpdate: () => Promise<void>

  // Data transfer and backups (docs/backup.md)
  exportData: () => Promise<string | null>
  pickImportFile: () => Promise<ParseResult | null>
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

export { THEME_STORAGE_KEY }

async function currentBackupText(): Promise<string> {
  const { templates, currentTemplateId, settings } = useAppStore.getState()
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  const theme = stored === 'light' || stored === 'dark' ? stored : null
  const version = await getVersion().catch(() => 'unknown')
  return buildBackup({ templates, currentTemplateId, settings, theme }, version)
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

const VALID_DAYS: readonly string[] = WEEKDAYS

/** Guards the invoice generator, which needs a real weekday name. */
function hasValidLessonDay(template: InvoiceTemplate): boolean {
  return VALID_DAYS.includes(template.day)
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

// Re-exported for existing importers (settings dialog).
export { getTermsForAcademicYear }

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
          const gmail = await backend.gmailStatus()
          set({ gmail, gmailConnected: gmail.connected })
        } catch (error) {
          console.error('Failed to read Gmail status:', errorMessage(error))
        }
      },

      connectGmail: async () => {
        set({ gmailConnecting: true })
        try {
          const gmail = await backend.gmailConnect()
          set({ gmail, gmailConnected: gmail.connected })
          return gmail
        } finally {
          set({ gmailConnecting: false })
          await get().refreshGmailStatus()
        }
      },

      cancelGmailConnect: async () => {
        await backend.gmailCancelConnect()
      },

      disconnectGmail: async () => {
        const gmail = await backend.gmailDisconnect()
        set({ gmail, gmailConnected: gmail.connected })
      },

      setCustomGmailClient: async (clientId, clientSecret) => {
        const gmail = await backend.gmailSetCustomClient(clientId, clientSecret)
        set({ gmail, gmailConnected: gmail.connected })
      },

      clearCustomGmailClient: async () => {
        const gmail = await backend.gmailClearCustomClient()
        set({ gmail, gmailConnected: gmail.connected })
      },

      createCurrentInvoiceDraft: async () => {
        const { currentInvoice, drafting } = get()
        if (drafting) return
        if (!currentInvoice) throw new Error('There is no invoice to save for this template right now.')
        if (currentInvoice.lessonCount === 0) throw new Error(NOTHING_TO_INVOICE)
        set({ drafting: true })
        try {
          await backend.gmailCreateDraft(currentInvoice.subject, currentInvoice.body)
        } catch (error) {
          if (isBackendError(error) && (error.kind === 'ReauthRequired' || error.kind === 'NotConnected')) {
            await get().refreshGmailStatus()
          }
          throw error
        } finally {
          set({ drafting: false })
        }
      },

      createAllInvoiceDrafts: async (onProgress) => {
        const state = get()
        if (state.drafting) return { outcomes: [], success: 0, failures: [], skipped: 0, nothingToInvoice: [] }
        const term = state.currentTerm
        if (!term) throw new Error('It is outside term time, so there are no invoices to create.')
        if (state.templates.length === 0) throw new Error('There are no templates yet.')
        set({ drafting: true })
        let success = 0
        let skipped = 0
        const failures: DraftFailure[] = []
        const nothingToInvoice: string[] = []
        const outcomes: DraftOutcome[] = []
        const report = (outcome: DraftOutcome) => {
          if (outcome.status !== 'saving') outcomes.push(outcome)
          onProgress?.(outcome)
        }
        try {
          for (const [i, template] of state.templates.entries()) {
            const label = `${template.students} (${template.recipient})`
            if (!hasValidLessonDay(template)) {
              const message = 'The lesson day is not set correctly. Edit the family and choose a day.'
              failures.push({ label, message })
              report({ templateId: template.id, status: 'failed', message })
              continue
            }
            const invoice = generateInvoice(template, term, state.settings.customEmailBodyTemplate)
            if (invoice.lessonCount === 0) {
              nothingToInvoice.push(label)
              report({ templateId: template.id, status: 'nothing', message: NOTHING_TO_INVOICE })
              continue
            }
            report({ templateId: template.id, status: 'saving' })
            try {
              await backend.gmailCreateDraft(invoice.subject, invoice.body)
              success++
              report({ templateId: template.id, status: 'saved' })
            } catch (error) {
              failures.push({ label, message: errorMessage(error) })
              report({ templateId: template.id, status: 'failed', message: errorMessage(error) })
              // Without a working connection every remaining draft would fail too.
              if (isBackendError(error) && ['ReauthRequired', 'NotConnected', 'NotConfigured'].includes(error.kind)) {
                skipped = state.templates.length - i - 1
                for (const rest of state.templates.slice(i + 1)) {
                  report({ templateId: rest.id, status: 'skipped', message: 'Not tried: fix the Gmail connection, then try again.' })
                }
                await get().refreshGmailStatus()
                break
              }
            }
          }
        } finally {
          set({ drafting: false })
        }
        return { outcomes, success, failures, skipped, nothingToInvoice }
      },

      draftTemplate: async (templateId) => {
        const state = get()
        if (state.drafting) return
        const template = state.templates.find((t) => t.id === templateId)
        if (!template || !state.currentTerm || !hasValidLessonDay(template)) {
          throw new Error('There is no invoice to save for this family right now.')
        }
        const invoice = generateInvoice(template, state.currentTerm, state.settings.customEmailBodyTemplate)
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
      checkForUpdates: () => backend.checkForUpdates(),
      installUpdate: async () => {
        // Best effort: an update never touches data, so don't block it.
        await get().backupNow('pre-update').catch((e) => console.warn('Pre-update backup failed:', errorMessage(e)))
        await backend.installUpdate()
      },

      // Data transfer and backups
      exportData: async () => {
        return backend.exportBackup(await currentBackupText(), suggestedBackupName())
      },

      pickImportFile: async () => {
        const text = await backend.importBackup()
        if (text === null) return null
        const { parseBackup } = await import('../lib/backup-parse')
        return parseBackup(text)
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
        if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme)
        get().generateCurrentInvoice()
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
        get().generateCurrentInvoice()
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map(template =>
            template.id === id
              ? { ...template, ...updates, updatedAt: new Date() }
              : template
          )
        }))
        get().generateCurrentInvoice()
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter(template => template.id !== id),
          currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId
        }))
        get().generateCurrentInvoice()
      },

      setCurrentTemplate: (id) => {
        set({ currentTemplateId: id })
        get().generateCurrentInvoice()
      },

      toggleLesson: (templateId, date) => {
        const { currentTerm, templates } = get()
        const template = templates.find((t) => t.id === templateId)
        if (!currentTerm || !template || !hasValidLessonDay(template)) return
        // Only this half-term's lesson dates are kept, so unticks from past
        // half-terms (or an old lesson day) are dropped here.
        const lessons = new Set(lessonDates(template, currentTerm).map(lessonDateKey))
        if (!lessons.has(date)) return
        const skipped = new Set((template.skippedLessonDates ?? []).filter((d) => lessons.has(d)))
        if (skipped.has(date)) skipped.delete(date)
        else skipped.add(date)
        get().updateTemplate(templateId, { skippedLessonDates: [...skipped].sort() })
      },

      // Appearance
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
        set((state) => ({
          settings: { ...state.settings, ...updates }
        }))
        get().generateCurrentInvoice()
      },

      // Terms
      currentTerm: null,

      calculateCurrentTerm: (date = new Date()) => {
        const termData = calculateTermData(date)
        set({ currentTerm: termData })
        get().generateCurrentInvoice()
      },

      // Invoice Generation
      currentInvoice: null,

      generateCurrentInvoice: () => {
        const state = get()
        const template = state.templates.find(t => t.id === state.currentTemplateId)
        const termData = state.currentTerm

        // No template selected, outside term time, or an unusable lesson day:
        // nothing to show (a stale invoice must never be displayed or copied).
        const invoice =
          template && termData && hasValidLessonDay(template)
            ? generateInvoice(template, termData, state.settings.customEmailBodyTemplate)
            : null
        set({ currentInvoice: invoice })
      },

      generateAllInvoicesAction: () => {
        const state = get()
        if (state.currentTerm) {
          return generateAllInvoices(state.templates.filter(hasValidLessonDay), state.currentTerm, state.settings.customEmailBodyTemplate)
        }
        return []
      },


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

// Initialize term calculation and Gmail status on app start
useAppStore.getState().calculateCurrentTerm()
void useAppStore.getState().refreshGmailStatus()
