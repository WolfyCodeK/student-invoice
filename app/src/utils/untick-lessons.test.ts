/**
 * Unticking a lesson that didn't happen: every worked example in
 * docs/proposals/2026-09-untick-lessons.md (approved for v1.1.0).
 */
import { describe, expect, it } from 'vitest'
import { calculateTermData } from './terms'
import { generateInvoice, lessonDateKey, lessonDates } from './invoice-generator'
import type { InvoiceTemplate } from '../types'

const autumn1 = calculateTermData(new Date(2026, 8, 26))!

function template(overrides: Partial<InvoiceTemplate>): InvoiceTemplate {
  return {
    id: 't', recipient: 'Sarah', students: 'Oliver', instrument: 'piano', day: 'Monday', cost: 25,
    createdAt: new Date(2026, 8, 1), updatedAt: new Date(2026, 8, 1), ...overrides,
  }
}

const sarah = (skipped?: string[]) => generateInvoice(template({ skippedLessonDates: skipped }), autumn1, undefined, 'Jo Teacher')
const rangeLine = (body: string) => body.split('\n').find((l) => l.startsWith('Lessons: ')) ?? ''

describe('lesson dates', () => {
  it('are the dates the v1.0.1 date range is built from', () => {
    expect(lessonDates(template({}), autumn1).map(lessonDateKey)).toEqual([
      '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26',
    ])
    expect(lessonDates(template({ day: 'Tuesday' }), autumn1).map(lessonDateKey)).toEqual([
      '2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20',
    ])
  })
})

describe('unticked lessons (proposal worked examples)', () => {
  it('nothing unticked: identical to v1.0.1', () => {
    expect(sarah()).toEqual(sarah([]))
    expect(sarah().lessonCount).toBe(8)
    expect(sarah().totalCost).toBe(200)
    expect(rangeLine(sarah().body)).toBe(
      'Lessons: 8, from Monday 7th September to and including Monday 26th October',
    )
  })

  it.each([
    [['2026-09-21'], 7, 175, 'Monday 7th September to and including Monday 26th October'],
    [['2026-10-26'], 7, 175, 'Monday 7th September to and including Monday 19th October'],
    [['2026-09-07'], 7, 175, 'Monday 14th September to and including Monday 26th October'],
    [['2026-09-21', '2026-09-28'], 6, 150, 'Monday 7th September to and including Monday 26th October'],
  ])('Sarah, unticked %j: %i lessons, £%d', (skipped, lessons, total, range) => {
    const inv = sarah(skipped)
    expect(inv.lessonCount).toBe(lessons)
    expect(inv.totalCost).toBe(total)
    expect(rangeLine(inv.body)).toBe(`Lessons: ${lessons}, from ${range}`)
    expect(inv.body).toContain(`${lessons} x £25.00 = £${total.toFixed(2)}`)
  })

  it('Priya, first and last lessons unticked', () => {
    const inv = generateInvoice(
      template({ recipient: 'Priya', students: 'Amara and Tobi', instrument: 'guitar', day: 'Tuesday', cost: 22.5, skippedLessonDates: ['2026-09-01', '2026-10-20'] }),
      autumn1,
    )
    expect(inv.lessonCount).toBe(6)
    expect(inv.totalCost).toBe(135)
    expect(rangeLine(inv.body)).toBe(
      'Lessons: 6, from Tuesday 8th September to and including Tuesday 13th October',
    )
  })

  it("Sarah's full email with Mon 26 Oct unticked: only the figures change", () => {
    expect(sarah(['2026-10-26']).body).toBe(`Hi Sarah,

Please find below the invoice for Oliver's piano lessons 1st half autumn term 2026.

Lessons: 7, from Monday 7th September to and including Monday 19th October

7 x £25.00 = £175.00

Many thanks,
Jo Teacher`)
  })

  it('one lesson left: the existing singular wording, range unchanged in form', () => {
    const all = lessonDates(template({}), autumn1).map(lessonDateKey)
    const inv = sarah(all.slice(1))
    expect(inv.lessonCount).toBe(1)
    expect(rangeLine(inv.body)).toBe(
      'Lessons: 1, from Monday 7th September to and including Monday 7th September',
    )
    expect(inv.body).toContain('1 x £25.00 = £25.00')
  })

  it('nothing ticked: no lessons and nothing to charge', () => {
    const all = lessonDates(template({}), autumn1).map(lessonDateKey)
    const inv = sarah(all)
    expect(inv.lessonCount).toBe(0)
    expect(inv.totalCost).toBe(0)
  })

  it('dates from another half-term or another weekday are ignored', () => {
    expect(sarah(['2026-11-09', '2026-09-22'])).toEqual(sarah())
  })

  it('custom email wording uses the ticked count', () => {
    const inv = generateInvoice(template({ skippedLessonDates: ['2026-09-21'] }), autumn1, '{{weeksCount}} {{lessonCountText}} = £{{totalCost}}')
    expect(inv.body).toBe('7 lessons = £175.00')
  })
})
