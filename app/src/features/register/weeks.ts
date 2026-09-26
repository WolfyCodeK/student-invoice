// The register's columns: one per calendar week (Monday to Sunday) from the
// week the half-term starts to the week of the last lesson charged. Lesson
// dates come from the billing code unchanged (docs/billing.md); this only
// decides where each one is drawn.
import { differenceInCalendarWeeks, eachWeekOfInterval, startOfWeek } from 'date-fns'
import type { InvoiceTemplate, TermData } from '../../types'
import { lessonDateKey, lessonDates } from '../../utils/invoice-generator'

const MONDAY = { weekStartsOn: 1 } as const

export interface RegisterWeek {
  /** The Monday that starts this week. */
  monday: Date
  /** The whole week is after the half-term has ended (today's rule can still charge it). */
  afterTerm: boolean
}

export interface RegisterLesson {
  date: Date
  key: string
  week: number
  ticked: boolean
}

export function registerWeeks(term: TermData, templates: Pick<InvoiceTemplate, 'day'>[]): RegisterWeek[] {
  let last = term.term.endDate
  for (const t of templates) {
    const dates = lessonDates(t, term)
    const end = dates[dates.length - 1]
    if (end && end > last) last = end
  }
  return eachWeekOfInterval({ start: term.term.startDate, end: last }, MONDAY).map((monday) => ({
    monday,
    afterTerm: monday > term.term.endDate,
  }))
}

export function registerLessons(template: InvoiceTemplate, term: TermData): RegisterLesson[] {
  const first = startOfWeek(term.term.startDate, MONDAY)
  const skipped = new Set(template.skippedLessonDates ?? [])
  return lessonDates(template, term).map((date) => {
    const key = lessonDateKey(date)
    return { date, key, week: differenceInCalendarWeeks(date, first, MONDAY), ticked: !skipped.has(key) }
  })
}
