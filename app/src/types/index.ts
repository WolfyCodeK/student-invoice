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
  /** v1.1.2: bank-holiday lessons ticked back on, so charged although the bank-holiday option is on. */
  chargedBankHolidays?: string[]
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

/**
 * v1.1.2: how lessons are charged (docs/billing.md). Each option is off when
 * absent, and with all of them off invoices are exactly as in v1.0.1.
 */
export interface ChargingOptions {
  /** Only lessons from the half-term's first day to its last day. */
  insideHalfTermOnly?: boolean
  /** Lessons on England and Wales bank holidays aren't charged unless ticked back on. */
  skipBankHolidays?: boolean
  /** Outside term time, the register shows the next half-term, ready to invoice. */
  nextHalfTermInHolidays?: boolean
}

/** One lesson date in a half-term record, charged or not. */
export interface HalfTermLesson {
  /** 'yyyy-MM-dd'. */
  date: string
  charged: boolean
  /** Why it wasn't charged. */
  reason?: 'unticked' | 'bank-holiday'
}

/** One family in a half-term record: as it was, whatever has changed since. */
export interface HalfTermFamily {
  /** The family's id (it may since have been deleted). */
  id: string
  recipient: string
  students: string
  instrument: string
  day: string
  cost: number
  lessons: HalfTermLesson[]
  lessonCount: number
  total: number
  paid?: boolean
  thanked?: boolean
  /** Deleted while the half-term was current (ISO time). Kept, but not in the totals. */
  removedAt?: string
}

/**
 * v1.1.2: the permanent record of one half-term (docs/data-model.md). Saved
 * while it is current, final once it has ended, and never deleted.
 */
export interface HalfTermRecord {
  /** First and last day, 'yyyy-MM-dd'. */
  start: string
  end: string
  half: string
  season: string
  families: HalfTermFamily[]
  /** The charging options in use. */
  charging?: ChargingOptions
  /** The half-term has ended, so the record is final (except Paid and Thanks sent). */
  ended?: boolean
  /** Not saved at the time: worked out later from the families and prices then. */
  workedOut?: boolean
  /** Last saved (ISO time). The newest copy wins when records are merged. */
  savedAt: string
}

/** Half-term records by `${school-year start}-${0..5}`, e.g. "2026-0" for the 1st half of autumn 2026. */
export type HalfTermRecords = Record<string, HalfTermRecord>

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
  /** v1.1.2: how lessons are charged. All off when absent. */
  charging?: ChargingOptions
  /** v1.1.2: every half-term's record. Never deleted; merged on import and restore. */
  halfTerms?: HalfTermRecords
}
