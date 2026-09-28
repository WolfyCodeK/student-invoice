/**
 * The v1.1.0 decisions that touch invoices, as approved:
 * - docs/proposals/2026-09-editable-term-dates.md (edited term dates);
 * - docs/proposals/2026-09-rules-review-decisions.md (part of a penny, stray
 *   spaces, "lessons" wording).
 * Figures and dates are read through a neutral line of test wording (FIGURES),
 * so the tests don't depend on the standard wording. With no edits and ordinary
 * data, invoices are exactly as before: that part is pinned by
 * billing.characterization.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { calculateTermData, getTermsForAcademicYear } from './terms'
import { generateInvoice, roundToPenny } from './invoice-generator'
import type { InvoiceTemplate, TermDateOverrides } from '../types'

const family = (overrides: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({
  id: 'f',
  recipient: 'Sarah',
  students: 'Oliver',
  instrument: 'piano',
  day: 'Monday',
  cost: 25,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
  ...overrides,
})

const autumn1 = (overrides?: TermDateOverrides) => calculateTermData(new Date(2026, 8, 10), overrides)!
const edit = (start: string, end: string): TermDateOverrides => {
  const usual = getTermsForAcademicYear(2026).map((t) => ({
    start: `${t.startDate.getFullYear()}-${String(t.startDate.getMonth() + 1).padStart(2, '0')}-${String(t.startDate.getDate()).padStart(2, '0')}`,
    end: `${t.endDate.getFullYear()}-${String(t.endDate.getMonth() + 1).padStart(2, '0')}-${String(t.endDate.getDate()).padStart(2, '0')}`,
  }))
  usual[0] = { start, end }
  return { '2026': usual }
}
/** A neutral line the figures and dates are read through (no particular email wording). */
const FIGURES = '{{weeksCount}} {{lessonCountText}}, {{dateRange}}'
const summary = (inv: ReturnType<typeof generateInvoice>) => [inv.lessonCount, inv.totalCost, inv.body]

describe('edited term dates (proposal worked examples)', () => {
  it("today's dates give today's invoices", () => {
    expect(summary(generateInvoice(family(), autumn1(), FIGURES, 'N'))).toEqual([
      8, 200, '8 lessons, Monday 7th September to and including Monday 26th October',
    ])
  })

  it('3 Sep to 23 Oct changes nothing for Monday or Friday', () => {
    const term = autumn1(edit('2026-09-03', '2026-10-23'))
    expect(term.term.startDate).toEqual(new Date(2026, 8, 3))
    expect(summary(generateInvoice(family(), term, FIGURES, 'N'))[0]).toBe(8)
    expect(summary(generateInvoice(family({ day: 'Friday', cost: 26 }), term, FIGURES, 'N')).slice(0, 2)).toEqual([8, 208])
  })

  it('3 Sep to 16 Oct (a two-week break) is one lesson fewer', () => {
    const term = autumn1(edit('2026-09-03', '2026-10-16'))
    expect(summary(generateInvoice(family(), term, FIGURES, 'N'))).toEqual([
      7, 175, '7 lessons, Monday 7th September to and including Monday 19th October',
    ])
    expect(summary(generateInvoice(family({ day: 'Friday', cost: 26 }), term, FIGURES, 'N')).slice(0, 2)).toEqual([7, 182])
  })

  it('only the edited school year changes, and unusable edits fall back to the usual dates', () => {
    const overrides = edit('2026-09-03', '2026-10-16')
    expect(getTermsForAcademicYear(2027, overrides)).toEqual(getTermsForAcademicYear(2027))
    expect(getTermsForAcademicYear(2026, { '2026': [{ start: '2026-09-31', end: '2026-10-16' }] })).toEqual(getTermsForAcademicYear(2026))
    const broken = { '2026': overrides['2026'].map((t, i) => (i === 3 ? { start: 'soon', end: t.end } : t)) }
    expect(getTermsForAcademicYear(2026, broken)).toEqual(getTermsForAcademicYear(2026))
  })

  it('counts calendar weeks, so the October clock change inside edited dates adds no lesson', () => {
    // 1 Sep to Tue 27 Oct 2026 is exactly 8 weeks; the clocks go back on 25 Oct.
    const term = autumn1(edit('2026-09-01', '2026-10-27'))
    expect(term.weeksCount).toBe(8)
    expect(generateInvoice(family(), term, undefined, 'N').lessonCount).toBe(8)
  })

  it('which half-term it is follows the edited dates', () => {
    // 2 September: term time with the usual dates, the holiday with a 3 September start.
    expect(calculateTermData(new Date(2026, 8, 2))?.term.half).toBe('1st')
    expect(calculateTermData(new Date(2026, 8, 2), edit('2026-09-03', '2026-10-16'))).toBeNull()
  })
})

describe('part of a penny', () => {
  it('rounds a price to the penny first, so the sum adds up', () => {
    const inv = generateInvoice(family({ cost: 12.345 }), autumn1(), '{{weeksCount}} x £{{cost}} = £{{totalCost}}', 'N')
    expect(inv.body).toBe('8 x £12.35 = £98.80')
    expect(generateInvoice(family({ cost: 12.345 }), autumn1(), undefined, 'N').body).toContain('Cost per lesson: £12.35\nTotal: £98.80')
    expect(inv.totalCost).toBeCloseTo(98.8, 10)
    expect(roundToPenny(19.999)).toBe(20)
  })

  it('leaves every ordinary price exactly as it was', () => {
    for (let pence = 0; pence <= 20000; pence += 7) {
      const price = Number((pence / 100).toFixed(2))
      expect(roundToPenny(price)).toBe(price)
    }
  })
})

describe('stray spaces around names', () => {
  it('never reach the email, with the standard or custom wording', () => {
    const f = family({ recipient: ' Sarah ', students: 'Oliver  ' })
    const inv = generateInvoice(f, autumn1(), undefined, 'N')
    expect(inv.body.startsWith('Hi Sarah,\n')).toBe(true)
    expect(inv.body).toContain("invoice for Oliver's piano lessons")
    expect(generateInvoice(f, autumn1(), '[{{recipient}}] [{{students}}]', 'N').body).toBe('[Sarah] [Oliver]')
  })
})

describe('"lessons" everywhere', () => {
  it('says lesson or lessons, never sessions', () => {
    const oneLeft = family({ skippedLessonDates: ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'] })
    expect(generateInvoice(oneLeft, autumn1(), '{{weeksCount}} {{lessonCountText}}', 'N').body).toBe('1 lesson')
    expect(generateInvoice(family(), autumn1(), '{{weeksCount}} {{lessonCountText}}', 'N').body).toBe('8 lessons')
    expect(generateInvoice(oneLeft, autumn1(), undefined, 'N').body).toContain('Lessons: 1, from')
    expect(generateInvoice(family(), autumn1(), undefined, 'N').body).not.toMatch(/session/i)
  })
})
