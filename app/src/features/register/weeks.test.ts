import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { calculateTermData } from '../../utils/terms'
import type { InvoiceTemplate } from '../../types'
import { registerLessons, registerWeeks } from './weeks'

const autumn1 = calculateTermData(new Date(2026, 8, 26))! // 1 Sep – 25 Oct 2026
const t = (day: string, skippedLessonDates?: string[]): InvoiceTemplate => ({
  id: day, recipient: 'R', students: 'S', instrument: 'piano', day, cost: 20, skippedLessonDates,
  createdAt: new Date(), updatedAt: new Date(),
})

describe('register weeks', () => {
  it('run from the week the half-term starts to the last lesson charged', () => {
    const weeks = registerWeeks(autumn1, [t('Monday'), t('Tuesday')])
    expect(weeks.map((w) => format(w.monday, 'd MMM'))).toEqual([
      '31 Aug', '7 Sep', '14 Sep', '21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct', '26 Oct',
    ])
    // Monday pupils are charged for Mon 26 Oct under today's rule: that week is after the half-term.
    expect(weeks.map((w) => w.afterTerm)).toEqual([false, false, false, false, false, false, false, false, true])
  })

  it('end at the half-term when no lesson falls after it', () => {
    expect(registerWeeks(autumn1, [t('Tuesday')])).toHaveLength(8)
  })

  it('place each lesson in its week, ticked unless unticked', () => {
    const monday = registerLessons(t('Monday', ['2026-09-21']), autumn1)
    expect(monday.map((l) => l.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(monday.filter((l) => !l.ticked).map((l) => l.key)).toEqual(['2026-09-21'])
    expect(registerLessons(t('Tuesday'), autumn1).map((l) => l.week)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})
