// The register's columns: one per calendar week (Monday to Sunday) from the
// week the half-term starts to the week of the last lesson charged. Lesson
// dates come from the billing code unchanged (docs/billing.md), or from a
// half-term's saved record; this only decides where each one is drawn.
import { differenceInCalendarWeeks, eachWeekOfInterval, format, parseISO, startOfWeek } from 'date-fns'
import type { HalfTermFamily, HalfTermRecord, InvoiceTemplate, TermData } from '../../types'
import { lessonCharges, lessonDates, type ChargeOptions, type LessonCharge } from '../../utils/invoice-generator'

const MONDAY = { weekStartsOn: 1 } as const

export interface RegisterWeek {
  /** The Monday that starts this week. */
  monday: Date
  /** The whole week is after the half-term has ended (the v1.0.1 rule can still charge it). */
  afterTerm: boolean
}

export interface RegisterLesson {
  date: Date
  key: string
  week: number
  ticked: boolean
  /** Why it isn't charged (unticked, or a bank holiday). */
  reason?: LessonCharge['reason']
}

/** "Mon 21 Sep: lesson", as a mark's tooltip says it. */
export function markTitle(l: RegisterLesson): string {
  const day = format(l.date, 'EEE d MMM')
  if (l.ticked) return `${day}: lesson`
  return l.reason === 'bank-holiday' ? `${day}: bank holiday, not charged` : `${day}: no lesson (not charged)`
}

function weeksFor(start: Date, end: Date, lessons: Date[]): RegisterWeek[] {
  let last = end
  for (const date of lessons) if (date > last) last = date
  return eachWeekOfInterval({ start, end: last }, MONDAY).map((monday) => ({ monday, afterTerm: monday > end }))
}

export function registerWeeks(term: TermData, templates: Pick<InvoiceTemplate, 'day'>[], options: ChargeOptions = {}): RegisterWeek[] {
  return weeksFor(term.term.startDate, term.term.endDate, templates.flatMap((t) => lessonDates(t, term, options).slice(-1)))
}

export function registerLessons(template: InvoiceTemplate, term: TermData, options: ChargeOptions = {}): RegisterLesson[] {
  const first = startOfWeek(term.term.startDate, MONDAY)
  return lessonCharges(template, term, options).map(({ date, key, charged, reason }) => ({
    date,
    key,
    week: differenceInCalendarWeeks(date, first, MONDAY),
    ticked: charged,
    ...(reason ? { reason } : {}),
  }))
}

/** The weeks of a saved half-term, as the register drew them then. */
export function recordWeeks(record: Pick<HalfTermRecord, 'start' | 'end' | 'families'>): RegisterWeek[] {
  return weeksFor(
    parseISO(record.start),
    parseISO(record.end),
    record.families.flatMap((f) => f.lessons.map((l) => parseISO(l.date))),
  )
}

/** A family's lessons in a saved half-term, placed in its weeks. */
export function recordLessons(family: Pick<HalfTermFamily, 'lessons'>, record: Pick<HalfTermRecord, 'start'>): RegisterLesson[] {
  const first = startOfWeek(parseISO(record.start), MONDAY)
  return family.lessons.map((l) => {
    const date = parseISO(l.date)
    return { date, key: l.date, week: differenceInCalendarWeeks(date, first, MONDAY), ticked: l.charged, ...(l.reason ? { reason: l.reason } : {}) }
  })
}
