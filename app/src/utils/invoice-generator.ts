import { InvoiceTemplate, TermData } from '../types'
import { format, addDays } from 'date-fns'

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

/**
 * Every lesson the half-term charges for (v1.0.1 rule): the first lesson day
 * on or after the half-term's start, then every 7 days, `weeksCount` times.
 */
export function lessonDates(template: Pick<InvoiceTemplate, 'day'>, termData: TermData): Date[] {
  const first = findFirstLessonDate(termData.term.startDate, template.day)
  return Array.from({ length: termData.weeksCount }, (_, i) => {
    const date = new Date(first)
    date.setDate(date.getDate() + i * 7)
    return date
  })
}

/**
 * A price rounded to the penny, so "8 x £12.35 = £98.80" always adds up
 * (docs/proposals/2026-09-rules-review-decisions.md). Rounds the decimal as
 * written, so 12.345 gives 12.35; an ordinary price comes back exactly as it was.
 */
export function roundToPenny(price: number): number {
  const pence = Math.round(Number(`${price}e2`))
  return Number.isFinite(pence) ? pence / 100 : Math.round(price * 100) / 100
}

/** `yourName` signs the email (settings "Your name"; docs/proposals/2026-09-your-name-sign-off.md). */
export function generateInvoice(template: InvoiceTemplate, termData: TermData, customBodyTemplate?: string, yourName = ''): InvoiceData {
  const { term } = termData
  // Spaces at either end of a name never reach the email, and the price is
  // whole pence (docs/proposals/2026-09-rules-review-decisions.md).
  const recipient = template.recipient.trim()
  const students = template.students.trim()
  const cost = roundToPenny(template.cost)

  // Lessons charged: every lesson date except the ones the teacher unticked
  // (docs/proposals/2026-09-untick-lessons.md). With nothing unticked this is
  // exactly the v1.0.1 calculation.
  const allDates = lessonDates(template, termData)
  const skipped = new Set(template.skippedLessonDates ?? [])
  const charged = allDates.filter((date) => !skipped.has(lessonDateKey(date)))
  const weeksCount = charged.length
  const rangeDates = charged.length > 0 ? charged : allDates
  const firstLessonDate = rangeDates[0]
  const lastLessonDate = rangeDates[rangeDates.length - 1]

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
    // Use default template
    const lessonCountText = weeksCount === 1 ? 'lesson' : 'lessons'
    body = `Hi ${recipient},

Please find below the invoice for ${students}'s ${template.instrument} lessons ${termInfo}.

Lessons: ${weeksCount}, from ${dateRange}

${weeksCount} x £${cost.toFixed(2)} = £${totalCost.toFixed(2)}

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

Please find below the invoice for {{students}}'s {{instrument}} lessons {{termInfo}}.

Lessons: {{weeksCount}}, from {{dateRange}}

{{weeksCount}} x £{{cost}} = £{{totalCost}}

Many thanks,
{{yourName}}`
}
