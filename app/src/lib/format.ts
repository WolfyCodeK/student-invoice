// How the screens write amounts and words. The invoice email's own wording
// comes from utils/invoice-generator.ts (docs/billing.md), not from here.

/** "£22.50". */
export const money = (pounds: number): string => `£${pounds.toFixed(2)}`

/** "piano" → "Piano". */
export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** "lesson" or "lessons". */
export const lessonsWord = (count: number): string => (count === 1 ? 'lesson' : 'lessons')
