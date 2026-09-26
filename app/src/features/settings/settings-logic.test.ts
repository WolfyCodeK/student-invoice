import { describe, expect, it } from 'vitest'
import { getDefaultTemplateString } from '../../utils/invoice-generator'
import {
  academicYearStart,
  activeSectionIndex,
  isSameTerm,
  nextRadioIndex,
  nextTermAfter,
  schoolYearLabel,
  termRange,
  termsBySeason,
  unknownPlaceholders,
  wordingToSave,
} from './settings-logic'
import { calculateTermData } from '../../utils/terms'

describe('school year', () => {
  it('starts in September', () => {
    expect(academicYearStart(new Date(2026, 8, 1))).toBe(2026)
    expect(academicYearStart(new Date(2026, 11, 31))).toBe(2026)
    expect(academicYearStart(new Date(2027, 0, 5))).toBe(2026)
    expect(academicYearStart(new Date(2027, 7, 31))).toBe(2026)
    expect(schoolYearLabel(2026)).toBe('2026/27')
    expect(schoolYearLabel(2099)).toBe('2099/00')
  })

  it('groups the six half-terms by season, 1st half first', () => {
    const seasons = termsBySeason(2026)
    expect(seasons.map((s) => s.label)).toEqual(['Autumn', 'Spring', 'Summer'])
    expect(seasons.map((s) => s.halves.map((t) => t.half))).toEqual([
      ['1st', '2nd'],
      ['1st', '2nd'],
      ['1st', '2nd'],
    ])
    expect(seasons.map((s) => s.halves.map((t) => termRange(t.startDate, t.endDate)))).toEqual([
      ['1 Sep – 25 Oct 2026', '3 Nov – 20 Dec 2026'],
      ['5 Jan – 14 Feb 2027', '23 Feb – 28 Mar 2027'],
      ['13 Apr – 23 May 2027', '1 Jun – 18 Jul 2027'],
    ])
  })

  it('writes the year on both dates when a range crosses a new year', () => {
    expect(termRange(new Date(2026, 11, 14), new Date(2027, 0, 8))).toBe('14 Dec 2026 – 8 Jan 2027')
  })

  it('recognises the current half-term', () => {
    const now = calculateTermData(new Date(2026, 8, 26))!.term
    const [autumn] = termsBySeason(2026)
    expect(isSameTerm(now, autumn.halves[0])).toBe(true)
    expect(isSameTerm(now, autumn.halves[1])).toBe(false)
    expect(isSameTerm(null, autumn.halves[0])).toBe(false)
    // Same half and season, a different year.
    expect(isSameTerm(now, termsBySeason(2025)[0].halves[0])).toBe(false)
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

describe('email wording', () => {
  it('finds words in curly brackets the app will not fill in', () => {
    expect(unknownPlaceholders(getDefaultTemplateString())).toEqual([])
    expect(unknownPlaceholders('Hi {{recipent}}, {{students}} {{ cost }} {{recipent}} {{}}')).toEqual(['{{recipent}}', '{{ cost }}', '{{}}'])
    expect(unknownPlaceholders('No placeholders, {single} braces')).toEqual([])
  })

  it('stores nothing for an empty box or the standard wording', () => {
    const standard = getDefaultTemplateString()
    expect(wordingToSave('   \n ', standard)).toBeUndefined()
    expect(wordingToSave(standard, standard)).toBeUndefined()
    expect(wordingToSave(`\n${standard}\n\n`, standard)).toBeUndefined()
    expect(wordingToSave('  Hello {{recipient}}\n', standard)).toBe('Hello {{recipient}}')
  })
})

describe('radio groups', () => {
  it('move with the arrow keys and wrap round', () => {
    expect(nextRadioIndex('ArrowRight', 0, 2)).toBe(1)
    expect(nextRadioIndex('ArrowDown', 1, 2)).toBe(0)
    expect(nextRadioIndex('ArrowLeft', 0, 2)).toBe(1)
    expect(nextRadioIndex('ArrowUp', 1, 3)).toBe(0)
    expect(nextRadioIndex('Home', 2, 3)).toBe(0)
    expect(nextRadioIndex('End', 0, 3)).toBe(2)
    expect(nextRadioIndex('ArrowLeft', -1, 3)).toBe(0)
    expect(nextRadioIndex('Enter', 0, 2)).toBeNull()
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBeNull()
  })
})

describe('section navigation', () => {
  const tops = [28, 400, 700, 1200]
  it('marks the section whose top has reached the top of the page', () => {
    expect(activeSectionIndex(tops, 0, 500, 2000)).toBe(0)
    expect(activeSectionIndex(tops, 320, 500, 2000)).toBe(1)
    expect(activeSectionIndex(tops, 1150, 500, 2000)).toBe(3)
  })
  it('marks the last section at the bottom, but not when nothing scrolls', () => {
    expect(activeSectionIndex(tops, 1500, 500, 2000)).toBe(3)
    expect(activeSectionIndex(tops, 0, 2000, 2000)).toBe(0)
    expect(activeSectionIndex([], 0, 500, 2000)).toBe(-1)
  })
})
