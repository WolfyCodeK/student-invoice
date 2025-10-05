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

export function generateInvoice(template: InvoiceTemplate, termData: TermData): InvoiceData {
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
  const lessonCountText = weeksCount === 1 ? 'session' : 'sessions'
  const body = `Hi ${template.recipient},

Here is my invoice for ${template.students}'s ${template.instrument} lessons ${termInfo}.

--------
There ${weeksCount === 1 ? 'is' : 'are'} ${weeksCount} ${lessonCountText} this ${termInfo} from ${dateRange}.

${weeksCount} x £${template.cost.toFixed(2)} = £${totalCost.toFixed(2)}

Thank you
--------

Kind regards
Robert`

  return {
    subject,
    body,
    totalCost,
    lessonCount: weeksCount,
    termInfo
  }
}

export function generateAllInvoices(templates: InvoiceTemplate[], termData: TermData): InvoiceData[] {
  return templates.map(template => generateInvoice(template, termData))
}
