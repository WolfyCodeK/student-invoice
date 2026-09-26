// Constants shared with code that must not pull in zod (kept out of the
// start-up bundle; see docs/performance.md). Re-exported by ./index.ts.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** Newest backup format this version can read and the one it writes. */
export const BACKUP_FORMAT_VERSION = 1
