/**
 * The v1.1.2 charging options, as approved in
 * docs/proposals/2026-09-v1.1.2-feedback.md (items 8 to 10): every worked
 * example, and proof that with the options off nothing changes. Figures and
 * dates are read through a neutral line of test wording (FIGURES).
 */
import { describe, expect, it } from 'vitest'
import { calculateTermData, currentTermData, getTermsForAcademicYear, termDataOf } from './terms'
import { generateInvoice, lessonCharges, lessonDateKey, type ChargeOptions } from './invoice-generator'
import type { InvoiceTemplate } from '../types'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const FIGURES = '{{weeksCount}} {{lessonCountText}}, {{dateRange}}'

const family = (overrides: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({
  id: 'f', recipient: 'Sarah', students: 'Oliver', instrument: 'piano', day: 'Monday', cost: 25,
  createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1), ...overrides,
})

/** Half-term `index` (0 to 5) of the school year starting in `year`, with the app's usual dates. */
const halfTerm = (year: number, index: number) => termDataOf(getTermsForAcademicYear(year)[index])
const line = (t: Partial<InvoiceTemplate>, year: number, index: number, options?: ChargeOptions) => {
  const inv = generateInvoice(family(t), halfTerm(year, index), FIGURES, 'N', options)
  return `${inv.body}, £${inv.totalCost.toFixed(2)}`
}

describe('with every option off', () => {
  it('invoices are exactly as without options, for every weekday, half-term and year', () => {
    for (const year of [2025, 2026, 2027, 2028]) {
      for (let i = 0; i < 6; i++) {
        for (const day of WEEKDAYS) {
          const plain = generateInvoice(family({ day }), halfTerm(year, i), FIGURES, 'N')
          const withBankHolidayTicks = family({ day, chargedBankHolidays: ['2027-05-03', '2028-04-17'] })
          for (const options of [{}, { insideHalfTermOnly: false, skipBankHolidays: false, nextHalfTermInHolidays: false }]) {
            expect(generateInvoice(family({ day }), halfTerm(year, i), FIGURES, 'N', options)).toEqual(plain)
            expect(generateInvoice(withBankHolidayTicks, halfTerm(year, i), FIGURES, 'N', options)).toEqual(plain)
          }
        }
      }
    }
  })

  it('termDataOf gives the same half-term as calculateTermData', () => {
    for (const year of [2025, 2026, 2027]) {
      for (const term of getTermsForAcademicYear(year)) expect(termDataOf(term)).toEqual(calculateTermData(term.startDate))
    }
  })
})

describe('8. only charge lessons inside the half-term', () => {
  const inside = { insideHalfTermOnly: true }

  it('the proposal table: 2026/27, Monday, £25', () => {
    expect(line({}, 2026, 0)).toBe('8 lessons, Monday 7th September to and including Monday 26th October, £200.00')
    expect(line({}, 2026, 0, inside)).toBe('7 lessons, Monday 7th September to and including Monday 19th October, £175.00')
    expect(line({}, 2026, 1)).toBe('7 lessons, Monday 9th November to and including Monday 21st December, £175.00')
    expect(line({}, 2026, 1, inside)).toBe('6 lessons, Monday 9th November to and including Monday 14th December, £150.00')
  })

  it('with the usual dates, only Monday families change in 2026/27; in 2027/28 Tuesday, then Wednesday after 29 February', () => {
    const changed = (year: number, index: number) => WEEKDAYS.filter((day) => line({ day }, year, index) !== line({ day }, year, index, inside))
    expect([0, 1, 2, 3, 4, 5].map((i) => changed(2026, i))).toEqual([['Monday'], ['Monday'], ['Monday'], ['Monday'], ['Monday'], ['Monday']])
    expect([0, 1, 2, 3, 4, 5].map((i) => changed(2027, i))).toEqual([['Tuesday'], ['Tuesday'], ['Tuesday'], [], ['Wednesday'], ['Wednesday']])
  })

  it('counts the last day of the half-term, and unticking still works on top', () => {
    // 1st half autumn 2026 ends on Sunday 25 October.
    expect(line({ day: 'Sunday' }, 2026, 0, inside)).toBe('8 lessons, Sunday 6th September to and including Sunday 25th October, £200.00')
    expect(line({ skippedLessonDates: ['2026-10-19'] }, 2026, 0, inside)).toBe(
      '6 lessons, Monday 7th September to and including Monday 12th October, £150.00',
    )
  })
})

describe('9. do not charge lessons on bank holidays', () => {
  const bh = { skipBankHolidays: true }

  it.each([
    ['2nd half spring 2027, Friday (Good Friday)', 'Friday', 2026, 3, 5, 4],
    ['2nd half spring 2027, Monday (Easter Monday)', 'Monday', 2026, 3, 5, 4],
    ['1st half summer 2027, Monday (Early May)', 'Monday', 2026, 4, 6, 5],
    ['1st half summer 2028, Monday (Easter Monday and Early May)', 'Monday', 2027, 4, 6, 4],
    ['1st half summer 2028, Friday (Good Friday)', 'Friday', 2027, 4, 6, 5],
  ])('the proposal table: %s', (_, day, year, index, before, after) => {
    const count = (options?: ChargeOptions) => generateInvoice(family({ day }), halfTerm(year, index), FIGURES, 'N', options).lessonCount
    expect(count()).toBe(before)
    expect(count(bh)).toBe(after)
  })

  it('1st half summer 2027, Monday: 5 → 4 with both options', () => {
    const inv = generateInvoice(family(), halfTerm(2026, 4), FIGURES, 'N', { ...bh, insideHalfTermOnly: true })
    expect(inv.lessonCount).toBe(4)
  })

  it('the date line: one in the middle changes nothing; one at the end moves the end in', () => {
    expect(line({}, 2026, 4, bh)).toBe('5 lessons, Monday 19th April to and including Monday 24th May, £125.00')
    expect(line({}, 2026, 3, bh)).toBe('4 lessons, Monday 1st March to and including Monday 22nd March, £100.00')
  })

  it('a bank-holiday lesson ticked back on is charged again', () => {
    expect(line({ chargedBankHolidays: ['2027-05-03'] }, 2026, 4, bh)).toBe(line({}, 2026, 4))
  })

  it('says why each lesson is or is not charged', () => {
    const lessons = lessonCharges(family({ skippedLessonDates: ['2027-04-26'] }), halfTerm(2026, 4), bh)
    expect(lessons.map(({ key, charged, reason }) => [key, charged, reason])).toEqual([
      ['2027-04-19', true, undefined],
      ['2027-04-26', false, 'unticked'],
      ['2027-05-03', false, 'bank-holiday'],
      ['2027-05-10', true, undefined],
      ['2027-05-17', true, undefined],
      ['2027-05-24', true, undefined],
    ])
    expect(lessons.map((l) => l.key)).toEqual(lessons.map((l) => lessonDateKey(l.date)))
  })
})

describe('10. in the holidays, show the next half-term', () => {
  it('outside term time: nothing, or with the option the next half-term', () => {
    const halfTermHoliday = new Date(2026, 9, 28) // between 25 Oct and 3 Nov
    expect(currentTermData(halfTermHoliday)).toBeNull()
    expect(currentTermData(halfTermHoliday, undefined, { nextHalfTermInHolidays: true })).toEqual(halfTerm(2026, 1))
    const summer = new Date(2027, 7, 10)
    expect(currentTermData(summer, undefined, { nextHalfTermInHolidays: true })).toEqual(halfTerm(2027, 0))
  })

  it('in term time, the option changes nothing', () => {
    const inTerm = new Date(2026, 8, 26)
    expect(currentTermData(inTerm, undefined, { nextHalfTermInHolidays: true })).toEqual(calculateTermData(inTerm))
    expect(currentTermData(inTerm)).toEqual(calculateTermData(inTerm))
  })
})

describe('a half-term with no lesson on the lesson day', () => {
  it('has nothing to invoice, and no error', () => {
    const oneDay = termDataOf({ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 1), half: '1st', season: 'autumn' })
    expect(generateInvoice(family(), oneDay, FIGURES, 'N', { insideHalfTermOnly: true }).lessonCount).toBe(0)
  })
})
