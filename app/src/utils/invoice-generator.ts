import { ChargingOptions, InvoiceTemplate, TermData } from '../types'
import { format, addDays } from 'date-fns'
import { isBankHoliday } from './bank-holidays'

export interface InvoiceData {
  subject: string
  body: string
  totalCost: number
  lessonCount: number
  termInfo: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function formatDateRange(startDate: Date, endDate: Date): string {
  const startWeekday = WEEKDAYS[startDate.getDay()]
  const endWeekday = WEEKDAYS[endDate.getDay()]
  const startDay = startDate.getDate()
  const endDay = endDate.getDate()
  const startMonth = MONTHS[startDate.getMonth()]
  const endMonth = MONTHS[endDate.getMonth()]

  return `${startWeekday} ${startDay}${getOrdinalSuffix(startDay)} ${startMonth} to and including ${endWeekday} ${endDay}${getOrdinalSuffix(endDay)} ${endMonth}`
}

function findFirstLessonDate(termStart: Date, lessonDay: string): Date {
  const targetDayIndex = WEEKDAYS.indexOf(lessonDay)
  let currentDate = new Date(termStart)

  // Find the first occurrence of the lesson day in the term
  while (currentDate.getDay() !== targetDayIndex) {
    currentDate = addDays(currentDate, 1)
  }

  return currentDate
}

/** A lesson date as stored in `skippedLessonDates`, e.g. "2026-10-26". */
export const lessonDateKey = (date: Date): string => format(date, 'yyyy-MM-dd')

/** The charging options that decide which lessons are charged (docs/proposals/2026-09-v1.1.2-feedback.md). */
export type ChargeOptions = Pick<ChargingOptions, 'insideHalfTermOnly' | 'skipBankHolidays'>

/**
 * Every lesson date the half-term can charge for (v1.0.1 rule): the first
 * lesson day on or after the half-term's start, then every 7 days,
 * `weeksCount` times. With `insideHalfTermOnly`, every lesson day from the
 * first day of the half-term to its last day instead.
 */
export function lessonDates(template: Pick<InvoiceTemplate, 'day'>, termData: TermData, options: ChargeOptions = {}): Date[] {
  const first = findFirstLessonDate(termData.term.startDate, template.day)
  if (options.insideHalfTermOnly) {
    const dates: Date[] = []
    for (let date = first; date <= termData.term.endDate; date = addDays(date, 7)) dates.push(date)
    return dates
  }
  return Array.from({ length: termData.weeksCount }, (_, i) => {
    const date = new Date(first)
    date.setDate(date.getDate() + i * 7)
    return date
  })
}

/** One lesson date, and whether it is charged. */
export interface LessonCharge {
  date: Date
  /** As `lessonDateKey`. */
  key: string
  charged: boolean
  /** Why it isn't charged: unticked by the teacher, or a bank holiday (with that option on). */
  reason?: 'unticked' | 'bank-holiday'
}

/**
 * Every lesson date of the half-term, charged unless unticked
 * (docs/proposals/2026-09-untick-lessons.md) or, with `skipBankHolidays`, on
 * a bank holiday that wasn't ticked back on.
 */
export function lessonCharges(
  template: Pick<InvoiceTemplate, 'day' | 'skippedLessonDates' | 'chargedBankHolidays'>,
  termData: TermData,
  options: ChargeOptions = {},
): LessonCharge[] {
  const skipped = new Set(template.skippedLessonDates ?? [])
  const bankHolidaysCharged = new Set(template.chargedBankHolidays ?? [])
  return lessonDates(template, termData, options).map((date): LessonCharge => {
    const key = lessonDateKey(date)
    if (skipped.has(key)) return { date, key, charged: false, reason: 'unticked' }
    if (options.skipBankHolidays && isBankHoliday(key) && !bankHolidaysCharged.has(key)) return { date, key, charged: false, reason: 'bank-holiday' }
    return { date, key, charged: true }
  })
}

/**
 * A price rounded to the penny, so 8 lessons at £12.35 always total £98.80
 * (docs/proposals/2026-09-rules-review-decisions.md). Rounds the decimal as
 * written, so 12.345 gives 12.35; an ordinary price comes back exactly as it was.
 */
export function roundToPenny(price: number): number {
  const pence = Math.round(Number(`${price}e2`))
  return Number.isFinite(pence) ? pence / 100 : Math.round(price * 100) / 100
}

/**
 * `yourName` signs the email (settings "Your name"; docs/proposals/2026-09-your-name-sign-off.md).
 * `options` are the v1.1.2 charging options; with none on, this is the v1.1.1 invoice.
 */
export function generateInvoice(template: InvoiceTemplate, termData: TermData, customBodyTemplate?: string, yourName = '', options: ChargeOptions = {}): InvoiceData {
  const { term } = termData
  // Spaces at either end of a name never reach the email, and the price is
  // whole pence (docs/proposals/2026-09-rules-review-decisions.md).
  const recipient = template.recipient.trim()
  const students = template.students.trim()
  const cost = roundToPenny(template.cost)

  // Lessons charged: every lesson date except the ones the teacher unticked
  // (docs/proposals/2026-09-untick-lessons.md) and those the charging options
  // leave out. With nothing unticked and no option on this is exactly the
  // v1.0.1 calculation.
  const lessons = lessonCharges(template, termData, options)
  const allDates = lessons.map((l) => l.date)
  const charged = lessons.filter((l) => l.charged).map((l) => l.date)
  const weeksCount = charged.length
  const rangeDates = charged.length > 0 ? charged : allDates
  // A half-term too short to hold the lesson day has no lessons: the range is
  // then the half-term itself (nothing can be invoiced, so it isn't sent).
  const firstLessonDate = rangeDates[0] ?? term.startDate
  const lastLessonDate = rangeDates[rangeDates.length - 1] ?? term.endDate

  // Generate term info
  const termInfo = `${term.half} half ${term.season} term ${format(term.startDate, 'yyyy')}`

  // Generate date range string
  const dateRange = formatDateRange(firstLessonDate, lastLessonDate)

  // Calculate total cost
  const totalCost = weeksCount * cost

  // Generate subject
  const subject = `Invoice for ${template.instrument.charAt(0).toUpperCase() + template.instrument.slice(1)} Lessons ${termInfo}`

  // Generate body
  let body: string
  if (customBodyTemplate) {
    // Use custom template with variable substitution
    body = customBodyTemplate
      .replace(/{{recipient}}/g, recipient)
      .replace(/{{students}}/g, students)
      .replace(/{{instrument}}/g, template.instrument)
      .replace(/{{termInfo}}/g, termInfo)
      .replace(/{{weeksCount}}/g, weeksCount.toString())
      .replace(/{{lessonCountText}}/g, weeksCount === 1 ? 'lesson' : 'lessons')
      .replace(/{{dateRange}}/g, dateRange)
      .replace(/{{cost}}/g, cost.toFixed(2))
      .replace(/{{totalCost}}/g, totalCost.toFixed(2))
      .replace(/{{isAre}}/g, weeksCount === 1 ? 'is' : 'are')
      .replace(/{{yourName}}/g, () => yourName)
  } else {
    // The standard wording: generic, the same text as getDefaultTemplateString()
    // (docs/proposals/2026-09-generic-standard-wording.md).
    body = `Hi ${recipient},

Please find below the invoice for ${students}'s ${template.instrument} lessons, ${termInfo}.

Lessons: ${weeksCount}, from ${dateRange}
Cost per lesson: £${cost.toFixed(2)}
Total: £${totalCost.toFixed(2)}

Many thanks,
${yourName}`
  }

  return {
    subject,
    body,
    totalCost,
    lessonCount: weeksCount,
    termInfo
  }
}

export function getDefaultTemplateString(): string {
  return `Hi {{recipient}},

Please find below the invoice for {{students}}'s {{instrument}} lessons, {{termInfo}}.

Lessons: {{weeksCount}}, from {{dateRange}}
Cost per lesson: £{{cost}}
Total: £{{totalCost}}

Many thanks,
{{yourName}}`
}
