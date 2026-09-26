// Pure helpers for the Settings screen (docs/ui.md "Settings"). No side
// effects, so they are unit-tested in settings-logic.test.ts. Term dates come
// from utils/terms.ts and are only displayed here, never changed.
import { format } from 'date-fns'
import { getTermsForAcademicYear } from '../../utils/terms'
import type { Term } from '../../types'

export const SECTIONS = ['appearance', 'gmail', 'wording', 'terms', 'data', 'performance', 'about'] as const

/** The year the school year containing `date` started in (it starts in September). */
export function academicYearStart(date: Date): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
}

/** "2026/27" for the school year starting in 2026. */
export function schoolYearLabel(start: number): string {
  return `${start}/${String(start + 1).slice(2)}`
}

export interface SeasonTerms {
  season: 'autumn' | 'spring' | 'summer'
  label: string
  halves: Term[]
}

/** The school year's six half-terms, grouped Autumn, Spring, Summer. */
export function termsBySeason(start: number): SeasonTerms[] {
  const terms = getTermsForAcademicYear(start)
  return (['autumn', 'spring', 'summer'] as const).map((season) => ({
    season,
    label: season.charAt(0).toUpperCase() + season.slice(1),
    halves: terms.filter((t) => t.season === season),
  }))
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

/** The words the invoice email fills in (utils/invoice-generator.ts). */
export const PLACEHOLDERS = [
  'recipient',
  'students',
  'instrument',
  'termInfo',
  'weeksCount',
  'lessonCountText',
  'dateRange',
  'cost',
  'totalCost',
  'isAre',
] as const

/**
 * Anything in double curly brackets that the app won't fill in, such as a
 * misspelling. It would appear in the email exactly as typed.
 */
export function unknownPlaceholders(text: string): string[] {
  const known: readonly string[] = PLACEHOLDERS
  const found = new Set<string>()
  for (const m of text.matchAll(/{{([^{}]*)}}/g)) {
    if (!known.includes(m[1])) found.add(m[0])
  }
  return [...found]
}

/**
 * What to store for the wording in the box: undefined means "use the standard
 * wording" (an empty box, or the standard wording unchanged, so it keeps
 * following the app's standard wording).
 */
export function wordingToSave(draft: string, standard: string): string | undefined {
  const trimmed = draft.trim()
  return trimmed === '' || trimmed === standard.trim() ? undefined : trimmed
}

/** Arrow keys, Home and End within a radio group (wrapping). Null for other keys. */
export function nextRadioIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return index < 0 ? 0 : (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return index < 0 ? 0 : (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * Which section the reader is on: the last one whose top has scrolled to
 * within `offset` px of the top, or the last section once the page is
 * scrolled to the bottom. `tops` are positions within the scrolling content.
 */
export function activeSectionIndex(tops: number[], scrollTop: number, viewHeight: number, scrollHeight: number, offset = 96): number {
  if (tops.length === 0) return -1
  if (scrollTop > 0 && scrollTop + viewHeight >= scrollHeight - 2) return tops.length - 1
  let active = 0
  tops.forEach((top, i) => {
    if (top <= scrollTop + offset) active = i
  })
  return active
}
