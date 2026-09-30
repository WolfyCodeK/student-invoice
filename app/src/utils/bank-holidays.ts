// England and Wales bank holidays, worked out without the internet
// (docs/proposals/2026-09-v1.1.2-feedback.md, option 9). Money-affecting when
// the "don't charge bank holidays" option is on: see the billing rule in
// CLAUDE.md before changing anything here.

const pad = (n: number) => String(n).padStart(2, '0')
/** 'yyyy-MM-dd' for a local date. */
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Easter Sunday (Gregorian calendar, the anonymous algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const firstMonday = (year: number, month: number) => {
  const d = new Date(year, month, 1)
  return addDays(d, (8 - d.getDay()) % 7)
}
const lastMonday = (year: number, month: number) => {
  const d = new Date(year, month + 1, 0)
  return addDays(d, -((d.getDay() + 6) % 7))
}

/**
 * Holidays moved or added by royal proclamation, as GOV.UK lists them. A new
 * one needs an app update. `moved` replaces the usual date of that holiday.
 */
const SPECIAL: Record<number, { moved?: Record<string, string>; extra?: string[] }> = {
  2011: { extra: ['2011-04-29'] },
  2012: { moved: { spring: '2012-06-04' }, extra: ['2012-06-05'] },
  2020: { moved: { earlyMay: '2020-05-08' } },
  2022: { moved: { spring: '2022-06-02' }, extra: ['2022-06-03', '2022-09-19'] },
  2023: { extra: ['2023-05-08'] },
}

/** Every England and Wales bank holiday in a calendar year, as 'yyyy-MM-dd', in date order. */
export function bankHolidays(year: number): string[] {
  const special = SPECIAL[year] ?? {}
  const days: string[] = []
  // New Year's Day, or the Monday after when it falls at a weekend.
  const newYear = new Date(year, 0, 1)
  days.push(key(newYear.getDay() === 6 ? addDays(newYear, 2) : newYear.getDay() === 0 ? addDays(newYear, 1) : newYear))
  const easter = easterSunday(year)
  days.push(key(addDays(easter, -2)), key(addDays(easter, 1)))
  days.push(special.moved?.earlyMay ?? key(firstMonday(year, 4)))
  days.push(special.moved?.spring ?? key(lastMonday(year, 4)))
  days.push(key(lastMonday(year, 7)))
  // Christmas Day and Boxing Day, with substitute weekdays when either is at a weekend.
  const christmas = new Date(year, 11, 25)
  switch (christmas.getDay()) {
    case 5: // Friday: Boxing Day (Saturday) moves to Monday
      days.push(key(christmas), key(addDays(christmas, 3)))
      break
    case 6: // Saturday: Monday and Tuesday
      days.push(key(addDays(christmas, 2)), key(addDays(christmas, 3)))
      break
    case 0: // Sunday: Boxing Day on Monday, Christmas on Tuesday
      days.push(key(addDays(christmas, 1)), key(addDays(christmas, 2)))
      break
    default:
      days.push(key(christmas), key(addDays(christmas, 1)))
  }
  days.push(...(special.extra ?? []))
  return [...new Set(days)].sort()
}

const cache = new Map<number, Set<string>>()

/** True when a 'yyyy-MM-dd' date is an England and Wales bank holiday. */
export function isBankHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4))
  let set = cache.get(year)
  if (!set) cache.set(year, (set = new Set(bankHolidays(year))))
  return set.has(date)
}
