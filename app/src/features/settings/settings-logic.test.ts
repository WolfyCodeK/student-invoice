import { describe, expect, it } from 'vitest'
import { getDefaultTemplateString } from '../../utils/invoice-generator'
import { activeSectionIndex, nextRadioIndex, termsBySeason, unknownPlaceholders, wordingToSave } from './settings-logic'
import { termRange } from '../../lib/term-display'

// The school-year helpers themselves are tested in lib/term-display.test.ts.
describe('school year', () => {
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
