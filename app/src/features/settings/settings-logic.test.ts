import { describe, expect, it } from 'vitest'
import { getDefaultTemplateString } from '../../utils/invoice-generator'
import { activeSectionIndex, halfTermName, nextRadioIndex, termDateTexts, termDatesProblem, unknownPlaceholders, withTermDates, wordingToSave } from './settings-logic'

// The school-year helpers themselves are tested in lib/term-display.test.ts.
describe('term dates (docs/proposals/2026-09-editable-term-dates.md)', () => {
  const usual = termDateTexts(2026)

  it('starts from the usual dates, in order, named for people', () => {
    expect(usual).toEqual([
      { start: '2026-09-01', end: '2026-10-25' },
      { start: '2026-11-03', end: '2026-12-20' },
      { start: '2027-01-05', end: '2027-02-14' },
      { start: '2027-02-23', end: '2027-03-28' },
      { start: '2027-04-13', end: '2027-05-23' },
      { start: '2027-06-01', end: '2027-07-18' },
    ])
    expect([0, 1, 2, 5].map(halfTermName)).toEqual(['Autumn, 1st half', 'Autumn, 2nd half', 'Spring, 1st half', 'Summer, 2nd half'])
  })

  it('accepts sensible edits and explains what is wrong with the rest', () => {
    const edit = (i: number, t: Partial<{ start: string; end: string }>) => usual.map((u, k) => (k === i ? { ...u, ...t } : u))
    expect(termDatesProblem(2026, usual)).toBeNull()
    expect(termDatesProblem(2026, edit(0, { start: '2026-09-03', end: '2026-10-23' }))).toBeNull()
    expect(termDatesProblem(2026, edit(0, { start: '2026-08-01' }))).toBeNull()
    expect(termDatesProblem(2026, edit(0, { end: '' }))).toBe('Fill in both dates for Autumn, 1st half.')
    expect(termDatesProblem(2026, edit(1, { start: '2026-02-30' }))).toBe('Fill in both dates for Autumn, 2nd half.')
    expect(termDatesProblem(2026, edit(0, { end: '2026-08-31' }))).toBe('Autumn, 1st half ends before it starts.')
    expect(termDatesProblem(2026, edit(1, { start: '2026-10-25' }))).toBe('Autumn, 2nd half starts before Autumn, 1st half has ended.')
    expect(termDatesProblem(2026, edit(0, { start: '2026-07-31' }))).toBe('The dates must be between 1 August 2026 and 31 August 2027.')
    expect(termDatesProblem(2026, edit(5, { end: '2027-09-01' }))).toBe('The dates must be between 1 August 2026 and 31 August 2027.')
  })

  it('keeps only real edits, per school year', () => {
    const edited = usual.map((u, k) => (k === 0 ? { start: '2026-09-03', end: '2026-10-16' } : u))
    const saved = withTermDates(undefined, 2026, edited)
    expect(saved).toEqual({ '2026': edited })
    expect(termDateTexts(2026, saved)[0]).toEqual({ start: '2026-09-03', end: '2026-10-16' })
    expect(termDateTexts(2027, saved)).toEqual(termDateTexts(2027))
    // Back to the usual dates: the year is forgotten, and nothing is left.
    expect(withTermDates(saved, 2026, usual)).toBeUndefined()
    const both = withTermDates(saved, 2027, termDateTexts(2027).map((u, k) => (k === 5 ? { ...u, end: '2028-07-14' } : u)))
    expect(Object.keys(both ?? {})).toEqual(['2026', '2027'])
    expect(Object.keys(withTermDates(both, 2026, usual) ?? {})).toEqual(['2027'])
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
