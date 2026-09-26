// Showing half-terms on screen (the register and Settings → Term dates).
// Term dates come from utils/terms.ts and are only displayed here, never
// changed (docs/billing.md).
import { format } from 'date-fns'
import { getTermsForAcademicYear } from '../utils/terms'
import type { Term } from '../types'

/** The year the school year containing `date` started in (it starts in September). */
export function academicYearStart(date: Date): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
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
export function nextTermAfter(date: Date): Term | null {
  const start = academicYearStart(date)
  const terms = [...getTermsForAcademicYear(start), ...getTermsForAcademicYear(start + 1)]
  return terms.find((t) => t.startDate > date) ?? null
}
