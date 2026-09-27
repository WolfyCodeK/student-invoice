// Pure helpers for the Settings screen (docs/ui.md "Settings"). No side
// effects, so they are unit-tested in settings-logic.test.ts. Term dates come
// from utils/terms.ts; the editing rules below are those of
// docs/proposals/2026-09-editable-term-dates.md.
import { format } from 'date-fns'
import { getTermsForAcademicYear } from '../../utils/terms'
import { capitalise } from '../../lib/format'
import type { TermDateOverrides, TermDates } from '../../types'

/** "Autumn, 1st half" for each of the six half-terms, in order. */
export function halfTermName(index: number): string {
  const season = ['autumn', 'spring', 'summer'][Math.floor(index / 2)]
  return `${capitalise(season)}, ${index % 2 === 0 ? '1st' : '2nd'} half`
}

/** The six half-terms of a school year as 'yyyy-MM-dd' text: the dates in use (edited or usual). */
export function termDateTexts(start: number, overrides?: TermDateOverrides): TermDates[] {
  return getTermsForAcademicYear(start, overrides).map((t) => ({
    start: format(t.startDate, 'yyyy-MM-dd'),
    end: format(t.endDate, 'yyyy-MM-dd'),
  }))
}

export function sameTermDates(a: TermDates[], b: TermDates[]): boolean {
  return a.length === b.length && a.every((t, i) => t.start === b[i].start && t.end === b[i].end)
}

function isRealDay(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}

/**
 * Why edited dates for the school year starting in `start` can't be saved, in
 * plain words, or null if they can: every date filled in, each half-term's
 * last day on or after its first, the six in order without overlapping, all
 * from 1 August that year to 31 August the next. ('yyyy-MM-dd' compares as text.)
 */
export function termDatesProblem(start: number, dates: TermDates[]): string | null {
  for (const [i, t] of dates.entries()) {
    if (!isRealDay(t.start) || !isRealDay(t.end)) return `Fill in both dates for ${halfTermName(i)}.`
  }
  const earliest = `${start}-08-01`
  const latest = `${start + 1}-08-31`
  if (dates.some((t) => t.start < earliest || t.end > latest)) {
    return `The dates must be between 1 August ${start} and 31 August ${start + 1}.`
  }
  for (const [i, t] of dates.entries()) {
    if (t.end < t.start) return `${halfTermName(i)} ends before it starts.`
    if (i > 0 && t.start <= dates[i - 1].end) return `${halfTermName(i)} starts before ${halfTermName(i - 1)} has ended.`
  }
  return null
}

/**
 * The stored term dates with the school year starting in `start` set to
 * `dates`. A year set back to the usual dates is removed, so only real edits
 * are kept; undefined when nothing is left.
 */
export function withTermDates(overrides: TermDateOverrides | undefined, start: number, dates: TermDates[]): TermDateOverrides | undefined {
  const next: TermDateOverrides = { ...(overrides ?? {}) }
  if (sameTermDates(dates, termDateTexts(start))) delete next[String(start)]
  else next[String(start)] = dates.map((t) => ({ start: t.start, end: t.end }))
  return Object.keys(next).length > 0 ? next : undefined
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
  lessonCountText: '"lesson" or "lessons"',
  dateRange: 'First to last lesson',
  cost: 'Cost per lesson',
  totalCost: 'Total',
  isAre: '"is" or "are"',
  yourName: 'Your name, from the box above',
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
 * The Settings page leaves room after its last group (settings-view.tsx), so
 * every section's top can reach the top and each is marked in turn.
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
