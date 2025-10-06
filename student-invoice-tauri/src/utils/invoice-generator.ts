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

export function generateInvoice(template: InvoiceTemplate, termData: TermData, customBodyTemplate?: string): InvoiceData {
  const { term, weeksCount } = termData

  // Calculate lesson dates
  const firstLessonDate = findFirstLessonDate(term.startDate, template.day)
  const lastLessonDate = new Date(firstLessonDate)
  lastLessonDate.setDate(lastLessonDate.getDate() + (weeksCount - 1) * 7)

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

Here is my invoice for ${template.students}'s ${template.instrument} lessons ${termInfo}.

--------
There ${weeksCount === 1 ? 'is' : 'are'} ${weeksCount} ${lessonCountText} this ${termInfo} from ${dateRange}.

${weeksCount} x £${template.cost.toFixed(2)} = £${totalCost.toFixed(2)}

Thank you
--------

Kind regards
Robert`
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

Here is my invoice for {{students}}'s {{instrument}} lessons {{termInfo}}.

--------
There {{isAre}} {{weeksCount}} {{lessonCountText}} this {{termInfo}} from {{dateRange}}.

{{weeksCount}} x £{{cost}} = £{{totalCost}}

Thank you
--------

Kind regards
Robert`
}

export function generateAllInvoices(templates: InvoiceTemplate[], termData: TermData, customBodyTemplate?: string): InvoiceData[] {
  return templates.map(template => generateInvoice(template, termData, customBodyTemplate))
}
