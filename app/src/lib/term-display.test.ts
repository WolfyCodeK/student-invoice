import { describe, expect, it } from 'vitest'
import { academicYearStart, isSameTerm, nextTermAfter, schoolYearLabel, termDatesYear, termRange } from './term-display'
import { calculateTermData, getTermsForAcademicYear } from '../utils/terms'

describe('school year', () => {
  it('starts in September', () => {
    expect(academicYearStart(new Date(2026, 8, 1))).toBe(2026)
    expect(academicYearStart(new Date(2026, 11, 31))).toBe(2026)
    expect(academicYearStart(new Date(2027, 0, 5))).toBe(2026)
    expect(academicYearStart(new Date(2027, 7, 31))).toBe(2026)
    expect(schoolYearLabel(2026)).toBe('2026/27')
    expect(schoolYearLabel(2099)).toBe('2099/00')
  })

  it('in Settings, moves on to the new school year on 1 August', () => {
    expect(termDatesYear(new Date(2027, 6, 31, 23))).toBe(2026)
    expect(termDatesYear(new Date(2027, 7, 1))).toBe(2027)
    expect(termDatesYear(new Date(2026, 11, 31))).toBe(2026)
    expect(termDatesYear(new Date(2027, 0, 1))).toBe(2026)
  })

  it('writes the year once, or on both dates when a range crosses a new year', () => {
    expect(termRange(new Date(2026, 8, 1), new Date(2026, 9, 25))).toBe('1 Sep – 25 Oct 2026')
    expect(termRange(new Date(2026, 11, 14), new Date(2027, 0, 8))).toBe('14 Dec 2026 – 8 Jan 2027')
  })

  it('recognises the current half-term', () => {
    const now = calculateTermData(new Date(2026, 8, 26))!.term
    const [autumn1, autumn2] = getTermsForAcademicYear(2026)
    expect(isSameTerm(now, autumn1)).toBe(true)
    expect(isSameTerm(now, autumn2)).toBe(false)
    expect(isSameTerm(null, autumn1)).toBe(false)
    // Same half and season, a different year.
    expect(isSameTerm(now, getTermsForAcademicYear(2025)[0])).toBe(false)
  })

  it('finds the next half-term during a holiday', () => {
    expect(termRange(nextTermAfter(new Date(2026, 9, 28))!.startDate, nextTermAfter(new Date(2026, 9, 28))!.endDate)).toBe(
      '3 Nov – 20 Dec 2026',
    )
    // Summer holiday: the next school year's first half-term.
    const next = nextTermAfter(new Date(2027, 7, 10))!
    expect([next.half, next.season, next.startDate.getFullYear()]).toEqual(['1st', 'autumn', 2027])
    // Christmas holiday.
    const spring = nextTermAfter(new Date(2026, 11, 28))!
    expect([spring.half, spring.season, spring.startDate.getFullYear()]).toEqual(['1st', 'spring', 2027])
  })
})
