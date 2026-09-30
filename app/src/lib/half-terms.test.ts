/**
 * The permanent half-term records (docs/proposals/2026-09-v1.1.2-feedback.md,
 * item 5): saved while current, final once ended, worked out when never
 * saved, never deleted, and merged on import and restore.
 */
import { describe, expect, it } from 'vitest'
import { calculateTermData, getTermsForAcademicYear } from '../utils/terms'
import { generateInvoice } from '../utils/invoice-generator'
import { halfTermKey, halfTermTotals, liveRecord, mergeRecords, syncRecords, withTick, workedOutRecord } from './half-terms'
import type { HalfTermRecords, InvoiceTemplate } from '../types'

const family = (overrides: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({
  id: 'sarah', recipient: 'Sarah ', students: 'Oliver', instrument: 'piano', day: 'Monday', cost: 25,
  createdAt: new Date(2025, 8, 1), updatedAt: new Date(2025, 8, 1), ...overrides,
})
const priya = family({ id: 'priya', recipient: 'Priya', students: 'Amara and Tobi', instrument: 'guitar', day: 'Tuesday', cost: 22.5 })

const at = (y: number, m: number, d: number) => new Date(y, m, d, 12)
const autumn1 = calculateTermData(at(2026, 8, 26))!
const sources = (templates: InvoiceTemplate[], day = at(2026, 8, 26)) => ({ currentTerm: calculateTermData(day), templates })

describe('keys', () => {
  it('name the school year and the half-term', () => {
    expect(getTermsForAcademicYear(2026).map(halfTermKey)).toEqual(['2026-0', '2026-1', '2026-2', '2026-3', '2026-4', '2026-5'])
  })
})

describe('the current half-term', () => {
  it('is saved with everything the register shows, exactly as the invoice says it', () => {
    const sarah = family({ skippedLessonDates: ['2026-09-21'] })
    const record = liveRecord(autumn1, [sarah, priya], undefined, undefined, at(2026, 8, 26))
    const invoice = generateInvoice(sarah, autumn1)
    expect(record).toMatchObject({ start: '2026-09-01', end: '2026-10-25', half: '1st', season: 'autumn' })
    expect(record.families[0]).toEqual({
      id: 'sarah', recipient: 'Sarah', students: 'Oliver', instrument: 'piano', day: 'Monday', cost: 25,
      lessons: [
        { date: '2026-09-07', charged: true },
        { date: '2026-09-14', charged: true },
        { date: '2026-09-21', charged: false, reason: 'unticked' },
        { date: '2026-09-28', charged: true },
        { date: '2026-10-05', charged: true },
        { date: '2026-10-12', charged: true },
        { date: '2026-10-19', charged: true },
        { date: '2026-10-26', charged: true },
      ],
      lessonCount: invoice.lessonCount,
      total: invoice.totalCost,
    })
    expect(record.families[1]).toMatchObject({ id: 'priya', lessonCount: 8, total: 180 })
  })

  it('keeps the charging options it was worked out with', () => {
    const record = liveRecord(autumn1, [family()], { insideHalfTermOnly: true, nextHalfTermInHolidays: true }, undefined, at(2026, 8, 26))
    expect(record.charging).toEqual({ insideHalfTermOnly: true })
    expect(record.families[0]).toMatchObject({ lessonCount: 7, total: 175 })
  })

  it('follows changes, keeping the ticks, and keeps a deleted family marked removed', () => {
    let records = syncRecords(undefined, sources([family(), priya]), at(2026, 8, 26))!
    records = withTick(records, '2026-0', records['2026-0'], 'sarah', 'paid', true, at(2026, 8, 27))
    records = syncRecords(records, sources([family({ cost: 30 })]), at(2026, 8, 28))!
    const [sarah, gone] = records['2026-0'].families
    expect(sarah).toMatchObject({ cost: 30, total: 240, paid: true })
    expect(gone).toMatchObject({ id: 'priya', total: 180, removedAt: at(2026, 8, 28).toISOString() })
  })

  it('is not saved again when nothing changed', () => {
    const records = syncRecords(undefined, sources([family()]), at(2026, 8, 26))
    expect(syncRecords(records, sources([family()]), at(2026, 8, 27))).toBe(records)
  })
})

describe('a half-term that has ended', () => {
  it('is final: later changes of price, family or options leave it as it was', () => {
    let records = syncRecords(undefined, sources([family()]), at(2026, 9, 20))!
    records = syncRecords(records, sources([family()], at(2026, 9, 26)), at(2026, 9, 26))! // half-term holiday
    expect(records['2026-0'].ended).toBe(true)
    const final = records['2026-0']
    records = syncRecords(records, { currentTerm: calculateTermData(at(2026, 10, 10)), templates: [family({ cost: 40 })], charging: { skipBankHolidays: true } }, at(2026, 10, 10))!
    expect(records['2026-0']).toBe(final)
    expect(records['2026-1'].families[0].cost).toBe(40)
  })

  it('can still have its Paid and Thanks sent ticks changed', () => {
    let records = syncRecords(undefined, sources([family()]), at(2026, 9, 20))!
    records = syncRecords(records, sources([family()], at(2026, 10, 10)), at(2026, 10, 10))!
    records = withTick(records, '2026-0', records['2026-0'], 'sarah', 'thanked', true, at(2026, 10, 11))
    expect(records['2026-0']).toMatchObject({ ended: true, savedAt: at(2026, 10, 11).toISOString() })
    expect(records['2026-0'].families[0].thanked).toBe(true)
    records = withTick(records, '2026-0', records['2026-0'], 'sarah', 'thanked', false, at(2026, 10, 12))
    expect(records['2026-0'].families[0]).not.toHaveProperty('thanked')
  })
})

describe('half-terms never saved', () => {
  it('are worked out once, from the families added by then, and marked worked out', () => {
    const late = family({ id: 'late', createdAt: new Date(2026, 0, 20) })
    const records = syncRecords(undefined, sources([family(), late]), at(2026, 8, 26))!
    // 2025/26 in full; nothing before the app existed, nothing not yet ended.
    expect(Object.keys(records).sort()).toEqual(['2025-0', '2025-1', '2025-2', '2025-3', '2025-4', '2025-5', '2026-0'])
    expect(records['2025-0']).toMatchObject({ workedOut: true, ended: true })
    expect(records['2025-1'].families.map((f) => f.id)).toEqual(['sarah'])
    expect(records['2025-2'].families.map((f) => f.id)).toEqual(['sarah', 'late'])
    expect(records['2026-0'].workedOut).toBeUndefined()
  })

  it('work out from a record-less half-term with the v1.0.1 rule when no option is on', () => {
    const spring2 = getTermsForAcademicYear(2025)[3]
    const record = workedOutRecord(spring2, [family()], undefined, at(2026, 8, 26))
    expect(record.families[0].lessonCount).toBe(generateInvoice(family(), calculateTermData(spring2.startDate)!).lessonCount)
  })
})

describe('import and restore', () => {
  const saved = (savedAt: Date, cost: number) => ({ start: '2026-09-01', end: '2026-10-25', half: '1st', season: 'autumn', families: [{ ...liveRecord(autumn1, [family({ cost })], undefined, undefined, savedAt).families[0] }], savedAt: savedAt.toISOString() })

  it('keep every half-term in either copy, and the newest where both have one', () => {
    const ours: HalfTermRecords = { '2026-0': saved(at(2026, 8, 20), 25), '2025-5': saved(at(2026, 6, 1), 20) }
    const theirs: HalfTermRecords = { '2026-0': saved(at(2026, 8, 25), 30), '2025-4': saved(at(2026, 4, 1), 20) }
    const merged = mergeRecords(ours, theirs)!
    expect(Object.keys(merged).sort()).toEqual(['2025-4', '2025-5', '2026-0'])
    expect(merged['2026-0'].families[0].cost).toBe(30)
    expect(mergeRecords(theirs, ours)!['2026-0'].families[0].cost).toBe(30)
  })

  it('restoring an older backup keeps the newer history', () => {
    const ours: HalfTermRecords = { '2026-0': saved(at(2026, 8, 25), 30) }
    expect(mergeRecords(ours, { '2026-0': saved(at(2026, 8, 1), 25) })!['2026-0'].families[0].cost).toBe(30)
    expect(mergeRecords(undefined, undefined)).toBeUndefined()
  })
})

describe('totals', () => {
  it('add up in pence, count what is paid, and leave out removed families', () => {
    const totals = halfTermTotals([
      { lessonCount: 7, total: 86.45, paid: true },
      { lessonCount: 8, total: 98.8 },
      { lessonCount: 0, total: 0, paid: true },
      { lessonCount: 8, total: 200, removedAt: '2026-09-28T11:00:00.000Z' },
    ])
    expect(totals).toEqual({ lessons: 15, total: 185.25, paid: 86.45, outstanding: 98.8, toPay: 2, paidCount: 1 })
  })
})
