// Template types
export interface InvoiceTemplate {
  id: string
  recipient: string
  cost: number
  instrument: string
  day: string
  students: string
  createdAt: Date
  updatedAt: Date
}

// Term types
export interface Term {
  startDate: Date
  endDate: Date
  half: string // '1st' or '2nd'
  season: string // 'autumn', 'spring', 'summer'
}

export interface TermData {
  term: Term
  weeksCount: number
}

// Invoice types
export interface InvoiceData {
  template: InvoiceTemplate
  term: Term
  totalLessons: number
  totalCost: number
  subject: string
  body: string
}

// Settings types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  emailMode: 'clipboard' | 'auto-draft'
  currentTemplateId?: string
  windowPosition: {
    x: number
    y: number
  }
}

// API Response types
export interface GmailDraftResponse {
  id: string
  message: {
    id: string
    threadId: string
  }
}

// Form types
export interface TemplateFormData {
  recipient: string
  cost: string
  instrument: string
  day: string
  students: string
}

// Utility types
export type EmailMode = 'clipboard' | 'auto-draft'
export type Theme = 'light' | 'dark' | 'system'
export type Instrument = 'piano' | 'drum' | 'guitar' | 'vocal' | 'music' | 'singing' | 'bass guitar' | 'classical guitar'
export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
