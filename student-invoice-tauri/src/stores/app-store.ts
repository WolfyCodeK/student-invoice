import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InvoiceTemplate, AppSettings, TermData } from '../types'
import { generateInvoice, generateAllInvoices, InvoiceData } from '../utils/invoice-generator'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

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

  // Gmail Integration
  gmailConnected: boolean
  gmailAuthUrl: string | null
  pkceVerifier: string | null
  showGmailAuthDialog: boolean
  updateGmailStatus: () => Promise<void>
  connectGmail: () => Promise<void>
  disconnectGmail: () => void
  exchangeGmailCode: (code: string) => Promise<void>
  hideGmailAuthDialog: () => void
  createGmailDraft: (subject: string, body: string) => Promise<any>
  createCurrentInvoiceDraft: () => Promise<any>
  createAllInvoiceDrafts: () => Promise<{success: number, failed: number, errors: string[]}>
  checkGmailAuthStatus: () => Promise<any>

  // Updates
  checkForUpdates: () => Promise<{available: boolean, version?: string, body?: string}>
  installUpdate: () => Promise<void>

  // UI State
  isLoading: boolean
  setLoading: (loading: boolean) => void
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  emailMode: 'clipboard',
  windowPosition: { x: 100, y: 100 },
  gmailClientId: '',
  gmailClientSecret: '',
  autoSave: true,
  showNotifications: true
}

// Term calculation logic based on the original Python code
const calculateTermData = (date: Date): TermData | null => {
  const autumnFirstHalf = {
    startDate: new Date(date.getFullYear(), 8, 1), // September 1
    endDate: new Date(date.getFullYear(), 9, 25),   // October 25
    half: '1st',
    season: 'autumn'
  }

  const autumnSecondHalf = {
    startDate: new Date(date.getFullYear(), 10, 3), // November 3
    endDate: new Date(date.getFullYear(), 11, 20),  // December 20
    half: '2nd',
    season: 'autumn'
  }

  const springFirstHalf = {
    startDate: new Date(date.getFullYear() + 1, 0, 5),  // January 5 (next year)
    endDate: new Date(date.getFullYear() + 1, 1, 14),    // February 14
    half: '1st',
    season: 'spring'
  }

  const springSecondHalf = {
    startDate: new Date(date.getFullYear() + 1, 1, 23), // February 23
    endDate: new Date(date.getFullYear() + 1, 2, 28),   // March 28
    half: '2nd',
    season: 'spring'
  }

  const summerFirstHalf = {
    startDate: new Date(date.getFullYear() + 1, 3, 13), // April 13
    endDate: new Date(date.getFullYear() + 1, 4, 23),   // May 23
    half: '1st',
    season: 'summer'
  }

  const summerSecondHalf = {
    startDate: new Date(date.getFullYear() + 1, 5, 1),  // June 1
    endDate: new Date(date.getFullYear() + 1, 6, 18),   // July 18
    half: '2nd',
    season: 'summer'
  }

  const terms = [
    autumnFirstHalf, autumnSecondHalf,
    springFirstHalf, springSecondHalf,
    summerFirstHalf, summerSecondHalf
  ]

  for (const term of terms) {
    if (date >= term.startDate && date <= term.endDate) {
      const weeksCount = Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
      return {
        term,
        weeksCount
      }
    }
  }

  return null
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Gmail Integration
      gmailConnected: false,
      gmailAuthUrl: null,
      pkceVerifier: null,
      showGmailAuthDialog: false,

      connectGmail: async () => {
        try {
          const currentSettings = get().settings

          if (!currentSettings.gmailClientId || !currentSettings.gmailClientSecret) {
            throw new Error('Gmail client ID and secret must be configured in settings')
          }

          console.log('Starting OAuth server and generating auth URL...')
          const authUrl = await invoke('start_oauth_server', {
            clientId: currentSettings.gmailClientId,
            clientSecret: currentSettings.gmailClientSecret
          }) as string

          console.log('Opening browser for Gmail authentication...')
          // Open browser automatically
          openUrl(authUrl)

          // Show a simple waiting dialog
          set({ showGmailAuthDialog: true })

        } catch (error) {
          console.error('Failed to start OAuth server:', error)
          throw error
        }
      },

      disconnectGmail: () => {
        set({ gmailConnected: false, gmailAuthUrl: null, pkceVerifier: null, showGmailAuthDialog: false })
      },

      hideGmailAuthDialog: () => {
        set({ showGmailAuthDialog: false, gmailAuthUrl: null, pkceVerifier: null })
      },

      exchangeGmailCode: async (code: string) => {
        try {
          const state = get()
          if (!state.pkceVerifier) {
            throw new Error('No PKCE verifier available')
          }
          const settings = state.settings
          if (!settings.gmailClientId || !settings.gmailClientSecret) {
            throw new Error('Gmail client ID and secret not found in settings')
          }

          await invoke('exchange_gmail_code', {
            code,
            pkceVerifier: state.pkceVerifier,
            clientId: settings.gmailClientId,
            clientSecret: settings.gmailClientSecret
          })

          // Update status after successful exchange
          await get().updateGmailStatus()
          set({ gmailAuthUrl: null, pkceVerifier: null, showGmailAuthDialog: false })
        } catch (error) {
          console.error('Failed to exchange Gmail code:', error)
          throw error
        }
      },

      updateGmailStatus: async () => {
        try {
          const status = await invoke('check_gmail_auth_status') as {
            has_token: boolean
            has_client_id: boolean
            has_client_secret: boolean
            token_expires_at?: string
            current_time: string
          }
          const isConnected = status.has_token && status.has_client_id && status.has_client_secret

          // Check if token is expired
          if (isConnected && status.token_expires_at) {
            const expiresAt = new Date(status.token_expires_at)
            const now = new Date()
            if (expiresAt <= now) {
              // Token is expired, mark as disconnected
              set({ gmailConnected: false })
              return
            }
          }

          set({ gmailConnected: isConnected })
        } catch (error) {
          console.error('Failed to check Gmail auth status:', error)
          set({ gmailConnected: false })
        }
      },

      createGmailDraft: async (subject: string, body: string) => {
        try {
          const result = await invoke('create_gmail_draft', { subject, body })
          set({ gmailConnected: true })
          return result
        } catch (error) {
          console.error('Failed to create Gmail draft:', error)
          throw error
        }
      },

      createCurrentInvoiceDraft: async () => {
        const state = get()
        if (state.currentInvoice) {
          return await state.createGmailDraft(state.currentInvoice.subject, state.currentInvoice.body)
        }
        throw new Error('No current invoice to send')
      },

      createAllInvoiceDrafts: async () => {
        const state = get()
        const invoices = state.generateAllInvoicesAction()

        if (invoices.length === 0) {
          throw new Error('No invoices to create drafts for')
        }

        let success = 0
        let failed = 0
        const errors: string[] = []

        for (const invoice of invoices) {
          try {
            await state.createGmailDraft(invoice.subject, invoice.body)
            success++
          } catch (error) {
            failed++
            const recipient = invoice.subject.match(/for (.+) Lessons/)?.[1] || 'Unknown'
            errors.push(`${recipient}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }

        return { success, failed, errors }
      },

      checkGmailAuthStatus: async () => {
        return await invoke('check_gmail_auth_status')
      },

      // Updates
      checkForUpdates: async () => {
        try {
          const result = await invoke<string>('check_for_updates')
          return JSON.parse(result)
        } catch (error) {
          console.error('Failed to check for updates:', error)
          throw error
        }
      },

      installUpdate: async () => {
        try {
          await invoke('install_update')
        } catch (error) {
          console.error('Failed to install update:', error)
          throw error
        }
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

      // Settings
      settings: defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates }
        }))
      },

      // Terms
      currentTerm: null,

      calculateCurrentTerm: (date = new Date()) => {
        const termData = calculateTermData(date)
        set({ currentTerm: termData })
      },

      // Invoice Generation
      currentInvoice: null,

      generateCurrentInvoice: () => {
        const state = get()
        const template = state.templates.find(t => t.id === state.currentTemplateId)
        const termData = state.currentTerm

        if (template && termData) {
          const invoice = generateInvoice(template, termData)
          set({ currentInvoice: invoice })
        }
      },

      generateAllInvoicesAction: () => {
        const state = get()
        if (state.currentTerm) {
          return generateAllInvoices(state.templates, state.currentTerm)
        }
        return []
      },

      // UI State
      isLoading: false,

      setLoading: (loading) => {
        set({ isLoading: loading })
      }
    }),
    {
      name: 'student-invoice-store',
      partialize: (state) => ({
        templates: state.templates,
        currentTemplateId: state.currentTemplateId,
        settings: state.settings,
        gmailConnected: state.gmailConnected
      })
    }
  )
)

// Initialize term calculation and Gmail status on app start
useAppStore.getState().calculateCurrentTerm()
// Check Gmail status asynchronously
setTimeout(() => {
  useAppStore.getState().updateGmailStatus()
}, 1000)
