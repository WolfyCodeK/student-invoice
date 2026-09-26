import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InvoiceTemplate, AppSettings, TermData } from '../types'
import { generateInvoice, generateAllInvoices, InvoiceData } from '../utils/invoice-generator'
import { calculateTermData, getTermsForAcademicYear } from '../utils/terms'
import { backend, isBackendError, errorMessage, type BackupReason, type GmailStatus, type UpdateInfo } from '../lib/backend'
import { buildBackup, suggestedBackupName } from '../lib/backup'
import type { ParseResult } from '../lib/backup-parse'
import type { BackupFile } from '../lib/schema'
import { WEEKDAYS } from '../lib/schema/constants'
import { getVersion } from '@tauri-apps/api/app'

/** One template's result from "Draft all". */
export interface DraftFailure {
  label: string
  message: string
}

interface AppState {
  // Templates
  templates: InvoiceTemplate[]
  currentTemplateId: string | null
  addTemplate: (template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTemplate: (id: string, updates: Partial<InvoiceTemplate>) => void
  deleteTemplate: (id: string) => void
  setCurrentTemplate: (id: string | null) => void

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
  createAllInvoiceDrafts: () => Promise<{ success: number; failures: DraftFailure[]; skipped: number }>

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

export const THEME_STORAGE_KEY = 'student-invoice-theme'

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

      createAllInvoiceDrafts: async () => {
        const state = get()
        if (state.drafting) return { success: 0, failures: [], skipped: 0 }
        const term = state.currentTerm
        if (!term) throw new Error('It is outside term time, so there are no invoices to create.')
        if (state.templates.length === 0) throw new Error('There are no templates yet.')
        set({ drafting: true })
        let success = 0
        let skipped = 0
        const failures: DraftFailure[] = []
        try {
          for (const [i, template] of state.templates.entries()) {
            if (!hasValidLessonDay(template)) {
              failures.push({ label: `${template.students} (${template.recipient})`, message: 'The lesson day is not set correctly. Edit the template and choose a day.' })
              continue
            }
            const invoice = generateInvoice(template, term, state.settings.customEmailBodyTemplate)
            try {
              await backend.gmailCreateDraft(invoice.subject, invoice.body)
              success++
            } catch (error) {
              failures.push({ label: `${template.students} (${template.recipient})`, message: errorMessage(error) })
              // Without a working connection every remaining draft would fail too.
              if (isBackendError(error) && ['ReauthRequired', 'NotConnected', 'NotConfigured'].includes(error.kind)) {
                skipped = state.templates.length - i - 1
                await get().refreshGmailStatus()
                break
              }
            }
          }
        } finally {
          set({ drafting: false })
        }
        return { success, failures, skipped }
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
