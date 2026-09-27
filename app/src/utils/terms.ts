import { TermData, TermDateOverrides } from '../types'

// Pure term-date logic, moved verbatim from stores/app-store.ts so it can be
// unit-tested without the store's side effects. Money-affecting: see the
// billing rule in CLAUDE.md before changing anything here.

// Generate terms for a given academic year (baseYear = the year autumn starts in)
const usualTerms = (baseYear: number) => [
  { startDate: new Date(baseYear, 8, 1),      endDate: new Date(baseYear, 9, 25),      half: '1st', season: 'autumn' },  // Sep 1 - Oct 25
  { startDate: new Date(baseYear, 10, 3),     endDate: new Date(baseYear, 11, 20),     half: '2nd', season: 'autumn' },  // Nov 3 - Dec 20
  { startDate: new Date(baseYear + 1, 0, 5),  endDate: new Date(baseYear + 1, 1, 14),  half: '1st', season: 'spring' },  // Jan 5 - Feb 14
  { startDate: new Date(baseYear + 1, 1, 23), endDate: new Date(baseYear + 1, 2, 28),  half: '2nd', season: 'spring' },  // Feb 23 - Mar 28
  { startDate: new Date(baseYear + 1, 3, 13), endDate: new Date(baseYear + 1, 4, 23),  half: '1st', season: 'summer' },  // Apr 13 - May 23
  { startDate: new Date(baseYear + 1, 5, 1),  endDate: new Date(baseYear + 1, 6, 18),  half: '2nd', season: 'summer' },  // Jun 1 - Jul 18
]

/** 'yyyy-MM-dd' as local midnight, the way the usual dates are made; null if it isn't a real date. */
function localDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return null
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return day.getMonth() === Number(m[2]) - 1 ? day : null
}

/**
 * The six half-terms of the school year starting in `baseYear`: the dates
 * edited in Settings when there are any (docs/proposals/2026-09-editable-term-dates.md),
 * otherwise the usual ones. Everything else about them is the same, so the
 * calculations below don't change. An unusable edited year falls back whole.
 */
export const getTermsForAcademicYear = (baseYear: number, overrides?: TermDateOverrides) => {
  const usual = usualTerms(baseYear)
  const edited = overrides?.[String(baseYear)]
  if (!Array.isArray(edited) || edited.length !== usual.length) return usual
  const days = edited.map((d) => [localDay(d?.start ?? ''), localDay(d?.end ?? '')] as const)
  if (days.some(([start, end]) => !start || !end)) return usual
  return usual.map((t, i) => ({ ...t, startDate: days[i][0]!, endDate: days[i][1]! }))
}

// Term calculation logic based on the original Python code
// Checks both the current academic year (autumn starting this year) and
// the previous academic year (for Jan-Jul when spring/summer terms apply)
export const calculateTermData = (date: Date, overrides?: TermDateOverrides): TermData | null => {
  const currentYear = date.getFullYear()

  // Check current academic year AND previous academic year
  // e.g. in Feb 2026 we need to check the 2025-2026 academic year (baseYear=2025)
  const allTerms = [
    ...getTermsForAcademicYear(currentYear, overrides),      // Academic year starting this autumn
    ...getTermsForAcademicYear(currentYear - 1, overrides),   // Academic year that started last autumn
  ]

  for (const term of allTerms) {
    if (date >= term.startDate && date <= term.endDate) {
      // Whole calendar days, so a clock change inside (edited) dates can't add
      // a lesson; for the usual dates this is exactly the v1.0.1 count
      // (bug audit B24; docs/proposals/2026-09-editable-term-dates.md).
      const days = Math.round((term.endDate.getTime() - term.startDate.getTime()) / (1000 * 60 * 60 * 24))
      const weeksCount = Math.ceil(days / 7)
      return {
        term,
        weeksCount
      }
    }
  }

  return null
}
