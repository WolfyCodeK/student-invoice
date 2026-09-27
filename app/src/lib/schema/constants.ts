// Constants (and the weekday check) shared with code that must not pull in
// zod, which is kept out of the start-up bundle (docs/performance.md).
// BACKUP_FORMAT_VERSION is re-exported by ./index.ts.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** A lesson day the invoice generator can use: a weekday name, capitalised. */
export function isWeekday(day: string): boolean {
  return (WEEKDAYS as readonly string[]).includes(day)
}

/** Newest backup format this version can read and the one it writes. */
export const BACKUP_FORMAT_VERSION = 1

/**
 * The longest text each field can hold. Imports accept exactly these, and the
 * editors stop typing at them, so every export can be imported again.
 */
export const MAX_LENGTH = {
  recipient: 5_000,
  students: 5_000,
  instrument: 1_000,
  emailWording: 200_000,
  yourName: 200,
} as const
