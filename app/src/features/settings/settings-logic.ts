// Pure helpers for the Settings screen (docs/ui.md "Settings"). No side
// effects, so they are unit-tested in settings-logic.test.ts. Term dates come
// from utils/terms.ts and are only displayed here, never changed.
import { getTermsForAcademicYear } from '../../utils/terms'
import { capitalise } from '../../lib/format'
import type { Term } from '../../types'

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
    label: capitalise(season),
    halves: terms.filter((t) => t.season === season),
  }))
}

/**
 * The words the invoice email fills in (utils/invoice-generator.ts), and what
 * each becomes. The wording group adds an example to `termInfo`.
 */
export const PLACEHOLDERS = {
  recipient: 'The name you greet',
  students: 'Student name(s)',
  instrument: 'The instrument, such as piano',
  termInfo: 'The half-term',
  weeksCount: 'Number of lessons',
  lessonCountText: '"session" or "sessions"',
  dateRange: 'First to last lesson',
  cost: 'Cost per lesson',
  totalCost: 'Total',
  isAre: '"is" or "are"',
} as const

const KNOWN_PLACEHOLDERS: ReadonlySet<string> = new Set(Object.keys(PLACEHOLDERS))

/**
 * Anything in double curly brackets that the app won't fill in, such as a
 * misspelling. It would appear in the email exactly as typed.
 */
export function unknownPlaceholders(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/{{([^{}]*)}}/g)) {
    if (!KNOWN_PLACEHOLDERS.has(m[1])) found.add(m[0])
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
