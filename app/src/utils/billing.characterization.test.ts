/**
 * Characterization tests: they pin the invoice maths EXACTLY as shipped in
 * v1.0.1 — including known issues recorded in docs/audits — so any change to
 * lesson counts, totals or dates shows up as a snapshot diff. The saved results
 * read the figures through a neutral line of test wording (FIGURES); the
 * standard email wording itself is pinned by the inline snapshot below.
 *
 * Billing rule (CLAUDE.md): do not update these snapshots without the owner's
 * written approval of the change (see docs/proposals/).
 */
import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { calculateTermData, getTermsForAcademicYear } from './terms'
import { generateInvoice, getDefaultTemplateString } from './invoice-generator'
import type { InvoiceTemplate } from '../types'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const ACADEMIC_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032]

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

function template(overrides: Partial<InvoiceTemplate> = {}): InvoiceTemplate {
  return {
    id: 'fixture',
    recipient: 'Alex Parent',
    cost: 20,
    instrument: 'piano',
    day: 'Monday',
    students: 'Sam',
    createdAt: new Date(2025, 0, 1),
    updatedAt: new Date(2025, 0, 1),
    ...overrides,
  }
}

/** A neutral line the figures and dates are read through (no particular email wording). */
const FIGURES = '{{weeksCount}} {{lessonCountText}}, {{dateRange}}'

describe('test environment', () => {
  it('runs in the UK time zone the app is used in', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60) // BST
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0) // GMT
  })
})

describe('v1.0.1 billing characterization', () => {
  it('lesson count, total and date range for every weekday in every term', async () => {
    const lines: string[] = []
    for (const year of ACADEMIC_YEARS) {
      for (const term of getTermsForAcademicYear(year)) {
        const termData = calculateTermData(term.startDate)
        expect(termData).not.toBeNull()
        const header = `${year} ${term.season}-${term.half} ${ymd(term.startDate)}..${ymd(term.endDate)} weeksCount=${termData!.weeksCount}`
        lines.push(header)
        for (const day of WEEKDAYS) {
          for (const cost of [20, 12.5]) {
            const inv = generateInvoice(template({ day, cost }), termData!, FIGURES)
            lines.push(`  ${day.padEnd(9)} £${cost.toFixed(2).padStart(5)} -> ${inv.lessonCount} x = £${inv.totalCost.toFixed(2)} | ${inv.body}`)
          }
        }
      }
    }
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/billing-v1.0.1.txt')
  })

  it('term detection at the boundaries of each term', async () => {
    const lines: string[] = []
    const describeResult = (d: Date) => {
      const r = calculateTermData(d)
      return r ? `${r.term.season}-${r.term.half} (${r.weeksCount}w)` : 'outside term'
    }
    for (const year of [2025, 2026]) {
      for (const term of getTermsForAcademicYear(year)) {
        const s = term.startDate
        const e = term.endDate
        const dayBefore = new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1, 12)
        const lastDayNoon = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 12)
        const dayAfter = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0)
        lines.push(
          `${year} ${term.season}-${term.half}: dayBefore=${describeResult(dayBefore)}; start00:00=${describeResult(s)}; end00:00=${describeResult(e)}; endNoon=${describeResult(lastDayNoon)}; dayAfter=${describeResult(dayAfter)}`,
        )
      }
    }
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/term-boundaries-v1.0.1.txt')
  })

  it('subject and default body text', () => {
    const termData = calculateTermData(new Date(2026, 8, 10))!
    const inv = generateInvoice(template({ instrument: 'bass guitar', day: 'Thursday', cost: 22.5 }), termData, undefined, 'Jo Teacher')
    expect(inv.subject).toMatchInlineSnapshot(`"Invoice for Bass guitar Lessons 1st half autumn term 2026"`)
    expect(inv.body).toMatchInlineSnapshot(`
      "Hi Alex Parent,

      Please find below the invoice for Sam's bass guitar lessons, 1st half autumn term 2026.

      Lessons: 8, from Thursday 3rd September to and including Thursday 22nd October
      Cost per lesson: £22.50
      Total: £180.00

      Many thanks,
      Jo Teacher"
    `)
  })

  it('custom body template: every placeholder, plus current edge-case behaviour', () => {
    const termData = calculateTermData(new Date(2026, 8, 10))!
    const custom = getDefaultTemplateString()
    const inv = generateInvoice(template(), termData, custom, 'Jo Teacher')
    const def = generateInvoice(template(), termData, undefined, 'Jo Teacher')
    expect(inv.body).toBe(def.body)
    // "Your name" is inserted literally, even if it looks like a replacement pattern.
    expect(generateInvoice(template(), termData, '{{yourName}}', 'A $& B').body).toBe('A $& B')

    // Names containing replacement patterns / other placeholders (recorded as-is).
    const tricky = generateInvoice(
      template({ recipient: 'Pat $& Co', students: 'Jo {{totalCost}}' }),
      termData,
      '{{recipient}} / {{students}} / {{totalCost}}',
    )
    expect(tricky.body).toMatchInlineSnapshot(`"Pat {{recipient}} Co / Jo 160.00 / 160.00"`)
  })
})
