// Showing half-terms on screen (the register and Settings → Term dates).
// Term dates come from utils/terms.ts, including any edited in Settings
// (docs/billing.md); they are only displayed here.
import { format } from 'date-fns'
import { getTermsForAcademicYear } from '../utils/terms'
import type { Term, TermDateOverrides } from '../types'

/**
 * The year the school year containing `date` started in: from September, or
 * from an edited autumn start in August.
 */
export function academicYearStart(date: Date, overrides?: TermDateOverrides): number {
  const year = date.getFullYear()
  if (date.getMonth() >= 8) return year
  return date >= getTermsForAcademicYear(year, overrides)[0].startDate ? year : year - 1
}

/**
 * The school year whose dates Settings shows: the one starting this autumn
 * from 1 August, so its dates can be filled in over the summer.
 */
export function termDatesYear(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
}

/** "2026/27" for the school year starting in 2026. */
export function schoolYearLabel(start: number): string {
  return `${start}/${String(start + 1).slice(2)}`
}

/** "1 Sep – 25 Oct 2026" (the year is shown once unless the dates cross a new year). */
export function termRange(start: Date, end: Date): string {
  return start.getFullYear() === end.getFullYear()
    ? `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
    : `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
}

export function isSameTerm(a: Term | null | undefined, b: Term): boolean {
  return !!a && a.season === b.season && a.half === b.half && a.startDate.getTime() === b.startDate.getTime()
}

/** The first half-term that starts after `date` (used outside term time). */
export function nextTermAfter(date: Date, overrides?: TermDateOverrides): Term | null {
  const start = academicYearStart(date, overrides)
  const terms = [...getTermsForAcademicYear(start, overrides), ...getTermsForAcademicYear(start + 1, overrides)]
  return terms.find((t) => t.startDate > date) ?? null
}
