// The permanent half-term records (docs/data-model.md "Half-term records";
// docs/proposals/2026-09-v1.1.2-feedback.md, item 5). A half-term's record is
// saved as it changes while it is current and is final once it ends. Records
// are never deleted: the store only adds, freezes, ticks and merges them.
// Figures come from the billing code, so a record says exactly what the
// invoice said. Pure functions; the store saves what they return.
import type { ChargingOptions, HalfTermFamily, HalfTermRecord, HalfTermRecords, InvoiceTemplate, Term, TermData, TermDateOverrides } from '../types'
import { generateInvoice, lessonCharges, lessonDateKey, roundToPenny, type ChargeOptions } from '../utils/invoice-generator'
import { getTermsForAcademicYear, termDataOf } from '../utils/terms'
import { isWeekday } from './schema/constants'
import { academicYearStart } from './term-display'

const SEASONS = ['autumn', 'spring', 'summer']

/** The school year the app was first released in: no invoice was made with it before. */
const FIRST_SCHOOL_YEAR = 2025

/** The year a half-term's school year starts in. */
export function schoolYearOf(term: Pick<Term, 'season' | 'startDate'>): number {
  const year = term.startDate.getFullYear()
  return term.season === 'autumn' ? year : year - 1
}

/** 0 to 5, in school-year order: 1st half autumn is 0, 2nd half summer is 5. */
export function halfTermIndex(term: Pick<Term, 'season' | 'half'>): number {
  return SEASONS.indexOf(term.season) * 2 + (term.half === '1st' ? 0 : 1)
}

/** A record's key: "2026-0" for the 1st half of autumn 2026. */
export function halfTermKey(term: Pick<Term, 'season' | 'half' | 'startDate'>): string {
  return `${schoolYearOf(term)}-${halfTermIndex(term)}`
}

/** The options that decide what a record's lessons were charged by, kept only when on. */
export function chargeOptions(charging?: ChargingOptions): ChargeOptions {
  return {
    ...(charging?.insideHalfTermOnly ? { insideHalfTermOnly: true } : {}),
    ...(charging?.skipBankHolidays ? { skipBankHolidays: true } : {}),
  }
}

/** One family's line in a half-term record, keeping its Paid and Thanks sent ticks. */
export function familyRecord(template: InvoiceTemplate, term: TermData, charging: ChargingOptions | undefined, previous?: HalfTermFamily): HalfTermFamily {
  const options = chargeOptions(charging)
  // The invoice's own figures (its wording doesn't matter here).
  const invoice = generateInvoice(template, term, ' ', '', options)
  return {
    id: template.id,
    recipient: template.recipient.trim(),
    students: template.students.trim(),
    instrument: template.instrument,
    day: template.day,
    cost: roundToPenny(template.cost),
    lessons: lessonCharges(template, term, options).map(({ key, charged, reason }) => (reason ? { date: key, charged, reason } : { date: key, charged })),
    lessonCount: invoice.lessonCount,
    total: invoice.totalCost,
    ...(previous?.paid ? { paid: true } : {}),
    ...(previous?.thanked ? { thanked: true } : {}),
  }
}

function recordOf(term: TermData, families: HalfTermFamily[], charging: ChargingOptions | undefined, now: Date, workedOut: boolean): HalfTermRecord {
  const used = chargeOptions(charging)
  return {
    start: lessonDateKey(term.term.startDate),
    end: lessonDateKey(term.term.endDate),
    half: term.term.half,
    season: term.term.season,
    families,
    ...(Object.keys(used).length > 0 ? { charging: used } : {}),
    ...(workedOut ? { workedOut: true } : {}),
    savedAt: now.toISOString(),
  }
}

/**
 * The current half-term's record as the register shows it now. Families
 * deleted meanwhile stay in it, marked removed, so nothing recorded is lost.
 */
export function liveRecord(term: TermData, templates: InvoiceTemplate[], charging: ChargingOptions | undefined, previous: HalfTermRecord | undefined, now: Date): HalfTermRecord {
  const before = new Map((previous?.families ?? []).map((f) => [f.id, f]))
  const families = templates.filter((t) => isWeekday(t.day)).map((t) => familyRecord(t, term, charging, before.get(t.id)))
  const onRegister = new Set(families.map((f) => f.id))
  for (const f of previous?.families ?? []) {
    if (!onRegister.has(f.id)) families.push(f.removedAt ? f : { ...f, removedAt: now.toISOString() })
  }
  return recordOf(term, families, charging, now, false)
}

/** When a family was added, or null if that isn't known. */
function createdOn(template: InvoiceTemplate): Date | null {
  const created = new Date(template.createdAt as unknown as string)
  return Number.isNaN(created.getTime()) ? null : created
}

/**
 * A half-term that was never saved (it ended before v1.1.2, or the app wasn't
 * opened during it), worked out from the families there are now: those added
 * by the time it ended, at today's prices, with the charging options now.
 */
export function workedOutRecord(term: Term, templates: InvoiceTemplate[], charging: ChargingOptions | undefined, now: Date): HalfTermRecord {
  const data = termDataOf(term)
  const families = templates
    .filter((t) => isWeekday(t.day) && (createdOn(t)?.getTime() ?? 0) <= term.endDate.getTime() + 86_400_000)
    .map((t) => familyRecord(t, data, charging))
  return recordOf(data, families, charging, now, true)
}

/** The same record, ignoring when it was saved. */
function sameRecord(a: HalfTermRecord, b: HalfTermRecord): boolean {
  return JSON.stringify({ ...a, savedAt: '' }) === JSON.stringify({ ...b, savedAt: '' })
}

export interface RecordSources {
  /** The half-term being invoiced (the register's), or null. */
  currentTerm: TermData | null
  templates: InvoiceTemplate[]
  charging?: ChargingOptions
  termDates?: TermDateOverrides
}

/**
 * The records brought up to date: the current half-term saved as it is now,
 * half-terms that have ended made final, and ended half-terms that were never
 * saved worked out once. Returns `records` itself when nothing changed.
 */
export function syncRecords(records: HalfTermRecords | undefined, sources: RecordSources, now = new Date()): HalfTermRecords | undefined {
  const { currentTerm, templates, charging, termDates } = sources
  const next: HalfTermRecords = { ...(records ?? {}) }
  let changed = false
  const today = lessonDateKey(now)
  const currentKey = currentTerm ? halfTermKey(currentTerm.term) : null

  if (currentTerm && currentKey) {
    const before = next[currentKey]
    const live = liveRecord(currentTerm, templates, charging, before, now)
    // Nothing is recorded until there is a family to record.
    if (before ? !sameRecord(before, live) : live.families.length > 0) {
      next[currentKey] = live
      changed = true
    }
  }

  for (const [key, record] of Object.entries(next)) {
    if (key !== currentKey && !record.ended && record.end < today) {
      next[key] = { ...record, ended: true, savedAt: now.toISOString() }
      changed = true
    }
  }

  // Worked out from the school year of the first family, never before the app existed.
  const created = templates.map(createdOn).filter((d): d is Date => d !== null)
  const thisYear = academicYearStart(now, termDates)
  const firstYear = created.length > 0 ? Math.max(FIRST_SCHOOL_YEAR, Math.min(...created.map((d) => academicYearStart(d, termDates)))) : thisYear
  for (let year = firstYear; year <= thisYear; year++) {
    for (const term of getTermsForAcademicYear(year, termDates)) {
      const key = halfTermKey(term)
      if (next[key] || key === currentKey || lessonDateKey(term.endDate) >= today) continue
      const record = workedOutRecord(term, templates, charging, now)
      if (record.families.length === 0) continue
      next[key] = { ...record, ended: true }
      changed = true
    }
  }

  return changed ? next : records
}

/**
 * Two sets of records as one: every half-term in either, and where both have
 * one, the copy saved most recently (import and restore can't lose history).
 */
export function mergeRecords(ours: HalfTermRecords | undefined, theirs: HalfTermRecords | undefined): HalfTermRecords | undefined {
  const merged: HalfTermRecords = { ...(ours ?? {}) }
  for (const [key, record] of Object.entries(theirs ?? {})) {
    const mine = merged[key]
    if (!mine || Date.parse(record.savedAt) > Date.parse(mine.savedAt)) merged[key] = record
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

export type Tick = 'paid' | 'thanked'

/** `record` (saved under `key`) with one family's Paid or Thanks sent tick set. */
export function withTick(records: HalfTermRecords | undefined, key: string, record: HalfTermRecord, familyId: string, tick: Tick, on: boolean, now = new Date()): HalfTermRecords {
  const families = record.families.map((f) => {
    if (f.id !== familyId) return f
    const { [tick]: _old, ...rest } = f
    return on ? { ...rest, [tick]: true } : rest
  })
  return { ...(records ?? {}), [key]: { ...record, families, savedAt: now.toISOString() } }
}

export interface HalfTermTotals {
  lessons: number
  total: number
  paid: number
  outstanding: number
  /** Families with something to pay, and how many of them have paid. */
  toPay: number
  paidCount: number
}

/** A half-term's totals, added up in pence. Families removed during it aren't counted. */
export function halfTermTotals(families: Pick<HalfTermFamily, 'lessonCount' | 'total' | 'paid' | 'removedAt'>[]): HalfTermTotals {
  const pence = (pounds: number) => Math.round(pounds * 100)
  let lessons = 0
  let total = 0
  let paid = 0
  let toPay = 0
  let paidCount = 0
  for (const f of families) {
    if (f.removedAt) continue
    lessons += f.lessonCount
    total += pence(f.total)
    if (f.total > 0) {
      toPay++
      if (f.paid) {
        paidCount++
        paid += pence(f.total)
      }
    }
  }
  return { lessons, total: total / 100, paid: paid / 100, outstanding: (total - paid) / 100, toPay, paidCount }
}
