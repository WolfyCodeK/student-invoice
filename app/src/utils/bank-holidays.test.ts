/**
 * England and Wales bank holidays, checked against GOV.UK's published lists
 * (www.gov.uk/bank-holidays), including substitute days and the one-off
 * holidays of 2022 and 2023.
 */
import { describe, expect, it } from 'vitest'
import { bankHolidays, isBankHoliday } from './bank-holidays'

describe('bankHolidays', () => {
  it.each([
    [2022, ['2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03', '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27']],
    [2023, ['2023-01-02', '2023-04-07', '2023-04-10', '2023-05-01', '2023-05-08', '2023-05-29', '2023-08-28', '2023-12-25', '2023-12-26']],
    [2024, ['2024-01-01', '2024-03-29', '2024-04-01', '2024-05-06', '2024-05-27', '2024-08-26', '2024-12-25', '2024-12-26']],
    [2025, ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05', '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26']],
    [2026, ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28']],
    [2027, ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28']],
  ])('%i matches GOV.UK', (year, expected) => {
    expect(bankHolidays(year)).toEqual(expected)
  })

  it('moves Christmas and Boxing Day off a weekend', () => {
    // 2021: Christmas Saturday, so Monday 27 and Tuesday 28.
    expect(bankHolidays(2021).filter((d) => d.startsWith('2021-12'))).toEqual(['2021-12-27', '2021-12-28'])
    // 2022: Christmas Sunday, so Monday 26 and Tuesday 27.
    expect(bankHolidays(2022).filter((d) => d.startsWith('2022-12'))).toEqual(['2022-12-26', '2022-12-27'])
    // 2020: Boxing Day Saturday, so Monday 28.
    expect(bankHolidays(2020).filter((d) => d.startsWith('2020-12'))).toEqual(['2020-12-25', '2020-12-28'])
  })

  it('answers for single dates, in any year', () => {
    expect(isBankHoliday('2027-05-03')).toBe(true)
    expect(isBankHoliday('2027-05-04')).toBe(false)
    expect(isBankHoliday('2030-12-25')).toBe(true)
  })
})
