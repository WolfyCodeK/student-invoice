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

export function generateInvoice(template: InvoiceTemplate, termData: TermData, customBodyTemplate?: string): InvoiceData {
  const { term } = termData

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
  const totalCost = weeksCount * template.cost

  // Generate subject
  const subject = `Invoice for ${template.instrument.charAt(0).toUpperCase() + template.instrument.slice(1)} Lessons ${termInfo}`

  // Generate body
  let body: string
  if (customBodyTemplate) {
    // Use custom template with variable substitution
    body = customBodyTemplate
      .replace(/{{recipient}}/g, template.recipient)
      .replace(/{{students}}/g, template.students)
      .replace(/{{instrument}}/g, template.instrument)
      .replace(/{{termInfo}}/g, termInfo)
      .replace(/{{weeksCount}}/g, weeksCount.toString())
      .replace(/{{lessonCountText}}/g, weeksCount === 1 ? 'session' : 'sessions')
      .replace(/{{dateRange}}/g, dateRange)
      .replace(/{{cost}}/g, template.cost.toFixed(2))
      .replace(/{{totalCost}}/g, totalCost.toFixed(2))
      .replace(/{{isAre}}/g, weeksCount === 1 ? 'is' : 'are')
  } else {
    // Use default template
    const lessonCountText = weeksCount === 1 ? 'session' : 'sessions'
    body = `Hi ${template.recipient},

Please find below the invoice for ${template.students}'s ${template.instrument} lessons ${termInfo}.

Lessons: ${weeksCount}, from ${dateRange}

${weeksCount} x £${template.cost.toFixed(2)} = £${totalCost.toFixed(2)}

Many thanks,
the teacher`
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
the teacher`
}

export function generateAllInvoices(templates: InvoiceTemplate[], termData: TermData, customBodyTemplate?: string): InvoiceData[] {
  return templates.map(template => generateInvoice(template, termData, customBodyTemplate))
}
