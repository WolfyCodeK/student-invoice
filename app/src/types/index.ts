// Template types
export interface InvoiceTemplate {
  id: string
  recipient: string
  cost: number
  instrument: string
  day: string
  students: string
  /** Lessons unticked because they didn't happen, as "yyyy-MM-dd" dates. Absent in v1.0.1 data. */
  skippedLessonDates?: string[]
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

/** One half-term's edited dates, as 'yyyy-MM-dd' (first and last day). */
export interface TermDates {
  start: string
  end: string
}

/**
 * Edited half-term dates, by the year the school year starts in ("2026").
 * Each holds all six half-terms in order: autumn, spring, summer, 1st half
 * then 2nd. Years not listed use the usual dates (docs/billing.md).
 */
export type TermDateOverrides = Record<string, TermDates[]>

// Settings types
export interface AppSettings {
  theme: 'light' | 'dark'
  emailMode: 'clipboard' | 'gmail-draft'
  defaultTemplateId?: string
  windowPosition: {
    x: number
    y: number
  }
  gmailClientId?: string
  gmailClientSecret?: string
  autoSave: boolean
  showNotifications: boolean
  customEmailBodyTemplate?: string
  /** Stored-data revision (see docs/data-model.md). Absent in v1.0.1 data. */
  dataRevision?: number
  /** v1.1.0 appearance (docs/ui.md). Light/dark stays in `theme` and the theme key. */
  colourScheme?: 'student-invoice' | 'navy-amber'
  corners?: 'square' | 'rounded'
  /** Newest version whose "What's new" (and tour) this PC has shown. */
  lastSeenVersion?: string
  /** v1.1.0: signs emails (`{{yourName}}`). Empty on a new install. */
  yourName?: string
  /** v1.1.0: school years whose half-term dates were edited in Settings. */
  termDates?: TermDateOverrides
}
