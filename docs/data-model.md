# Data model and storage

All user data lives in the WebView2 **localStorage** of the app's origin
`http://tauri.localhost`. On disk that is inside
`%LOCALAPPDATA%\com.isaac.student-invoice\EBWebView\`. There is no database
and nothing in the cloud. The only other files the app writes are in the same
folder:

- `backups\`: automatic backups (see [backup](backup.md));
- `preferences.json`: per-PC settings that must be known before the window
  opens, currently only Low memory mode (see
  [performance](performance.md#low-memory-mode)). It is not part of the
  store, exports or backups.

> Dev builds (`pnpm tauri dev`) use the origin `http://localhost:3000`, so
> development data is separate from the installed app's data.

## localStorage keys

| Key | Written by | Contents |
|---|---|---|
| `student-invoice-store` | zustand `persist` in `app/src/stores/app-store.ts` | `{"state": {templates, currentTemplateId, settings, gmailConnected}, "version": 0}` |
| `student-invoice-theme` | `app/src/lib/appearance.ts` | `"light"` or `"dark"` (light or dark mode) |
| `student-invoice-store-unreadable`, or `student-invoice-store-unreadable-<ms>` if that key already holds a different copy | the store's `safeStorage`, only when stored data couldn't be read at start-up (see below) | the unreadable `student-invoice-store` text, exactly as it was. The app never reads it back; it is kept so the data can be recovered by hand. v1.0.1 ignores it |

Gmail credentials are **not** in localStorage. The refresh token (and an
optional custom OAuth client) live in Windows Credential Manager, and the
access token only in the Rust process's memory (see [Gmail](gmail.md)).

## Persisted shapes

From `app/src/types/index.ts`:

```ts
interface InvoiceTemplate {        // one per student / family
  id: string                       // crypto.randomUUID()
  recipient: string                // who the email is addressed to
  cost: number                     // £ per lesson
  instrument: string               // e.g. "piano"
  day: string                      // weekday name, "Monday".."Sunday"
  students: string                 // student name(s)
  skippedLessonDates?: string[]    // v1.1.0: unticked lessons, "yyyy-MM-dd" (docs/billing.md)
  chargedBankHolidays?: string[]   // v1.1.2: bank-holiday lessons ticked back on, "yyyy-MM-dd"
  createdAt: Date                  // stored as ISO string; not revived to Date on load
  updatedAt: Date                  // stored as ISO string; not revived to Date on load
}

interface AppSettings {
  theme: 'light' | 'dark'           // fallback only; the theme key above wins
  emailMode: 'clipboard' | 'gmail-draft'   // unused
  defaultTemplateId?: string        // unused (no longer shown in Settings)
  windowPosition: { x, y }          // unused
  gmailClientId?: string            // legacy (v1.0.1); cleared to '' at every start
  gmailClientSecret?: string        // legacy (v1.0.1); cleared to '' at every start
  autoSave: boolean                 // unused
  showNotifications: boolean        // unused (no longer shown in Settings)
  customEmailBodyTemplate?: string  // replaces the default email body
  dataRevision?: number             // v1.1.0+: which upgrades have run (see below)
  colourScheme?: 'student-invoice' | 'navy-amber'  // v1.1.0 (docs/ui.md "Appearance")
  corners?: 'square' | 'rounded'    // v1.1.0
  lastSeenVersion?: string          // v1.1.0: newest "What's new" shown on this PC
  yourName?: string                 // v1.1.0: signs emails ({{yourName}}); empty on a new install (docs/ui.md "Your name")
  termDates?: {                     // v1.1.0: half-term dates edited in Settings (docs/billing.md "Term dates")
    [schoolYearStart: string]:      //   "2026" for 2026/27; only years that differ from the usual dates
      { start: string; end: string }[]  // six half-terms in order, 'yyyy-MM-dd'
  }
  charging?: {                      // v1.1.2: charging options, each off when absent (docs/billing.md)
    insideHalfTermOnly?: boolean
    skipBankHolidays?: boolean
    nextHalfTermInHolidays?: boolean
  }
  halfTerms?: {                     // v1.1.2: the half-term records (below)
    [key: string]: HalfTermRecord   //   "2026-0": school year 2026/27, half-term 0 (1st half autumn) to 5
  }
}
```

`currentTemplateId` is the template selected when the app last closed.
`gmailConnected` is still written so that v1.0.1 can read the data, but
v1.1.0 never shows it: the UI uses the live status from Rust
(`gmail_status`), and says "Checking Gmail…" until it arrives
([Gmail](gmail.md#status-and-disconnect)).

Draft all's results (`draftResults`) live in the store but are never
persisted: they last until the user closes them or the app closes.

## Half-term records

v1.1.2 keeps a permanent record of every half-term in `settings.halfTerms`
([proposal](proposals/2026-09-v1.1.2-feedback.md), item 5), so years later
the user can see every lesson that was invoiced. The logic is in
`app/src/lib/half-terms.ts`, tested in `app/src/lib/half-terms.test.ts` and
`app/src/stores/app-store.test.ts`.

```ts
interface HalfTermRecord {
  start: string; end: string        // the half-term's first and last day, 'yyyy-MM-dd'
  half: string; season: string      // '1st' | '2nd', 'autumn' | 'spring' | 'summer'
  families: HalfTermFamily[]
  charging?: { insideHalfTermOnly?: true; skipBankHolidays?: true }  // options in use, when any
  ended?: boolean                   // the half-term has ended: final
  workedOut?: boolean               // not saved at the time: worked out later
  savedAt: string                   // ISO time; the newest copy wins a merge
}
interface HalfTermFamily {
  id: string                        // the family's id (it may since have been deleted)
  recipient: string; students: string; instrument: string; day: string
  cost: number                      // rounded to the penny, as the invoice used it
  lessons: { date: string; charged: boolean; reason?: 'unticked' | 'bank-holiday' }[]
  lessonCount: number; total: number   // the invoice's own figures
  paid?: true; thanked?: true       // the register's Paid and Thanks ticks
  removedAt?: string                // deleted while the half-term was current (ISO time)
}
```

- **Saved while current.** `syncHalfTerms` in the store runs whenever the
  families, the current half-term, the charging options or the term dates
  change, and once at start-up. It rebuilds the current half-term's record
  from the register (`liveRecord`), keeping the Paid and Thanks
  ticks, and writes it only when something in it changed. Nothing is
  recorded until there is a family.
- **Final once ended.** A record whose last day has passed, and which isn't
  the current half-term, gets `ended: true` and is never rebuilt: a later
  change of price, family, option or term dates leaves it as it was. Only
  its ticks can change (`setHalfTermTick`).
- **Families deleted meanwhile** stay in the current record with
  `removedAt`, so nothing recorded is lost; they aren't counted in its
  totals.
- **Worked out when never saved.** Half-terms that ended without a record
  (before v1.1.2, or when the app wasn't opened during one) are worked out
  once, from the school year of the earliest family's `createdAt` (never
  before 2025/26, when the app was first released): the families added by
  then, at the prices and with the charging options of the moment
  (`workedOutRecord`), marked `workedOut`. On the first start of v1.1.2 the
  options are all off, so earlier half-terms get the v1.1.1 figures, with no
  unticks (older versions didn't keep past unticks).
- **Never deleted.** Nothing removes a record: not deleting a family, not
  changing a price, option or term dates, not clearing the wording.
- **Always backed up.** Records are part of `settings`, so they are in every
  automatic backup and every export, and the daily backup runs while any
  record exists even with no families left.
- **Merged on import and restore.** `replaceAllData` replaces the families
  and settings as before, except `halfTerms`, which are merged
  (`mergeRecords`): every half-term in either copy is kept, and where both
  have one, the one with the later `savedAt` wins. Restoring an older backup
  can't lose newer history.
- **Size.** Five years of weekly lessons for twenty families is a few hundred
  kilobytes, well inside localStorage and the 5 MB import limit.
- **Older versions** keep the field: v1.1.0 and v1.1.1 merge settings and
  keep unknown fields, and v1.0.1 keeps `settings` whole (rule 3 below). They
  don't add to it.

## Loading and upgrading stored data

- **Loading:** zustand loads the stored state synchronously when the store
  module is created, through the store's own storage (`safeStorage` in
  `app/src/stores/app-store.ts`) rather than zustand's default. The store's
  custom `merge` fills in defaults for settings that didn't exist when the
  data was written, which zustand's shallow merge would otherwise leave
  `undefined`.
- **Unreadable data is set aside, never overwritten.** Stored data counts as
  unreadable if it isn't valid JSON, isn't an object with a `state` object,
  has a `version` other than 0 (zustand would discard it), or has
  `templates` that isn't an array or `settings` that isn't an object. Then:
  - it is copied to `student-invoice-store-unreadable`, or to
    `student-invoice-store-unreadable-<ms>` if that key already holds a
    different copy (an identical copy isn't saved twice), and the app starts
    with the defaults;
  - if there is no room for the copy, the original is left where it is and
    nothing is saved for the rest of the session, unless an import or
    restore replaces everything (`replaceAllData`);
  - if loading fails part-way for another reason (zustand reports an
    error), what is stored is copied aside in the same way;
  - `App` then shows "Your saved data couldn't be read" once
    (`takeStartupDataProblem()`), until the user closes it
    ([UI](ui.md#toasts)).
- **Write guard:** `safeStorage` ignores every write (`storageWritable`)
  until loading has finished, or, for unreadable data, until it has been
  copied aside. This enforces rule 4 below.
- **Upgrading (`migrateStoredData` in the store):** runs on every start,
  from `App`.
  - `settings.dataRevision` (absent in v1.0.1 data) records which upgrades
    have been applied; the current revision is 1. Each upgrade runs once.
  - If the stored revision is older and there is user data (templates,
    custom wording or Your name), a `pre-migration` automatic backup is saved
    first (see [backup](backup.md)). The upgrade is applied only if that
    backup succeeded; otherwise it is retried on the next start. A fresh
    install has nothing to back up, so it just records the current revision.
- **Legacy Google credentials (every start):** v1.0.1 stored the Google
  client ID and secret in plaintext in `settings`. `migrateStoredData` sets
  both fields to `''` on every start, before any backup and whatever the
  revision, so credentials typed again after going back to v1.0.1 don't stay
  stored either. No backup is needed first, because backups never include
  them. The fields are kept, so older versions still load the data, but
  someone who downgrades to v1.0.1 would have to paste credentials again to
  use Gmail there.
- **Revision 1:** it used to be the clearing above (done only once); it now
  only records itself.
- **v1.1.2** needs no upgrade: its new fields are optional and off when
  absent. The half-term records are started by `syncHalfTerms`, not by a
  migration (see [Half-term records](#half-term-records)).
- **Your name:** no upgrade sets `yourName`, so data from v1.0.1 has none
  until the user types it ([UI](ui.md#your-name)). v1.0.1 ignores the field
  and signs the standard wording with its own hard-coded name. **Known
  limitation:** custom wording saved in v1.1.0 or later usually contains
  `{{yourName}}` (the standard text ends with it). v1.0.1 doesn't know that
  placeholder, so after a downgrade its emails would show `{{yourName}}`
  literally until the wording is edited there. Downgrades are rare, and
  changing stored wording to suit v1.0.1 would break it for v1.1.0.
- **Unusable lesson days:** a template whose `day` isn't one of the seven
  weekday names (possible only through damaged data) produces no invoice and
  is reported by Draft all, instead of reaching the invoice generator.

## Schema

The stored shape is described in zod in `app/src/lib/schema/index.ts`
(`persistedStateSchema`). Shared constants live in
`app/src/lib/schema/constants.ts`, so code that only needs them doesn't pull in
zod: the weekday names; `isWeekday()`, the one check for a valid lesson day;
and `MAX_LENGTH`, the longest text each field can hold. The import schema
accepts exactly `MAX_LENGTH`, and the editors stop typing at it, so every
export can be imported again ([backup](backup.md#import)).
`persistedStateSchema` is lenient, because unknown fields from newer
versions must survive. It is shown here as JSON Schema:

<!-- GEN:persisted-schema -->
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "templates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "recipient": {
            "type": "string"
          },
          "cost": {
            "type": "number"
          },
          "instrument": {
            "type": "string"
          },
          "day": {
            "type": "string"
          },
          "students": {
            "type": "string"
          },
          "skippedLessonDates": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "chargedBankHolidays": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "createdAt": {},
          "updatedAt": {}
        },
        "required": [
          "id",
          "recipient",
          "cost",
          "instrument",
          "day",
          "students"
        ],
        "additionalProperties": {}
      }
    },
    "currentTemplateId": {
      "type": [
        "string",
        "null"
      ]
    },
    "settings": {
      "type": "object",
      "properties": {
        "theme": {
          "type": "string",
          "enum": [
            "light",
            "dark"
          ]
        },
        "customEmailBodyTemplate": {
          "type": "string"
        },
        "gmailClientId": {
          "type": "string"
        },
        "gmailClientSecret": {
          "type": "string"
        }
      },
      "additionalProperties": {}
    },
    "gmailConnected": {
      "type": "boolean"
    }
  },
  "required": [
    "templates",
    "currentTemplateId",
    "settings"
  ],
  "additionalProperties": {}
}
```
<!-- /GEN:persisted-schema -->

Backups in `%LOCALAPPDATA%\com.isaac.student-invoice\backups\` and export
files use the stricter backup format; see [backup](backup.md).

## Rules for changing persisted data

These rules keep every installed version working, including a downgrade from
a newer version back to v1.0.1. The reasons are explained in
[compatibility](compatibility.md) (invariant `store-key`).

1. **Never change the persist `name`, and never set a `version`** other than 0.
   zustand 5 discards stored data when the stored version doesn't match and
   no migration exists. v1.0.1 has no migration.
2. **Changes are additive only.** Add optional fields; never rename or remove a
   field, and never change a field's type (for example, `cost` stays a number
   of pounds and `day` stays a weekday name).
3. **Put new data inside `settings` or inside template objects**, not in new
   top-level state keys. v1.0.1 keeps unknown fields inside those objects
   when it saves, but it drops unknown top-level keys.
4. Nothing may write to storage before the stored state has been loaded
   (otherwise defaults would overwrite real data). Loading is synchronous
   (localStorage), and the write guard in `safeStorage` enforces it: writes
   are ignored until loading has finished, and data that couldn't be read is
   copied aside before anything replaces it (or, with no room for a copy,
   never replaced).
5. Every upgrade goes in `migrateStoredData`, bumps `CURRENT_DATA_REVISION`,
   and is covered by `app/src/stores/app-store.test.ts`.
