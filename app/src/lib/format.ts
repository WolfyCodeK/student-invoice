// How the screens write amounts and words. The invoice email's own wording
// comes from utils/invoice-generator.ts (docs/billing.md), not from here.

/** "£22.50", written as the invoice email writes it. */
export const money = (pounds: number): string => `£${pounds.toFixed(2)}`

/** A half-term's total, "£1,219.00": grouped, as it is never next to an email. */
export const moneyTotal = (pounds: number): string =>
  `£${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "piano" → "Piano". */
export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * How the app names an instrument: "drum" is shown as "Drums". Only the
 * screens: the value stored and used in emails stays "drum"
 * (docs/proposals/2026-09-v1.1.2-feedback.md, item 1).
 */
export const instrumentLabel = (instrument: string): string => (instrument === 'drum' ? 'Drums' : capitalise(instrument))

/** "lesson" or "lessons". */
export const lessonsWord = (count: number): string => (count === 1 ? 'lesson' : 'lessons')
