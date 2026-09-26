import { TermData } from '../types'

// Pure term-date logic, moved verbatim from stores/app-store.ts so it can be
// unit-tested without the store's side effects. Money-affecting: see the
// billing rule in CLAUDE.md before changing anything here.

// Generate terms for a given academic year (baseYear = the year autumn starts in)
export const getTermsForAcademicYear = (baseYear: number) => [
  { startDate: new Date(baseYear, 8, 1),      endDate: new Date(baseYear, 9, 25),      half: '1st', season: 'autumn' },  // Sep 1 - Oct 25
  { startDate: new Date(baseYear, 10, 3),     endDate: new Date(baseYear, 11, 20),     half: '2nd', season: 'autumn' },  // Nov 3 - Dec 20
  { startDate: new Date(baseYear + 1, 0, 5),  endDate: new Date(baseYear + 1, 1, 14),  half: '1st', season: 'spring' },  // Jan 5 - Feb 14
  { startDate: new Date(baseYear + 1, 1, 23), endDate: new Date(baseYear + 1, 2, 28),  half: '2nd', season: 'spring' },  // Feb 23 - Mar 28
  { startDate: new Date(baseYear + 1, 3, 13), endDate: new Date(baseYear + 1, 4, 23),  half: '1st', season: 'summer' },  // Apr 13 - May 23
  { startDate: new Date(baseYear + 1, 5, 1),  endDate: new Date(baseYear + 1, 6, 18),  half: '2nd', season: 'summer' },  // Jun 1 - Jul 18
]

// Term calculation logic based on the original Python code
// Checks both the current academic year (autumn starting this year) and
// the previous academic year (for Jan-Jul when spring/summer terms apply)
export const calculateTermData = (date: Date): TermData | null => {
  const currentYear = date.getFullYear()

  // Check current academic year AND previous academic year
  // e.g. in Feb 2026 we need to check the 2025-2026 academic year (baseYear=2025)
  const allTerms = [
    ...getTermsForAcademicYear(currentYear),      // Academic year starting this autumn
    ...getTermsForAcademicYear(currentYear - 1),   // Academic year that started last autumn
  ]

  for (const term of allTerms) {
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
