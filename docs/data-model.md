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
  createdAt: Date                  // stored as ISO string; not revived to Date on load
  updatedAt: Date                  // stored as ISO string; not revived to Date on load
}

interface AppSettings {
  theme: 'light' | 'dark'           // fallback only; the theme key above wins
  emailMode: 'clipboard' | 'gmail-draft'   // unused
  defaultTemplateId?: string        // unused (no longer shown in Settings)
  windowPosition: { x, y }          // unused
  gmailClientId?: string            // legacy (v1.0.1); cleared to '' on load
  gmailClientSecret?: string        // legacy (v1.0.1); cleared to '' on load
  autoSave: boolean                 // unused
  showNotifications: boolean        // unused (no longer shown in Settings)
  customEmailBodyTemplate?: string  // replaces the default email body
  dataRevision?: number             // v1.1.0+: which upgrades have run (see below)
  colourScheme?: 'student-invoice' | 'navy-amber'  // v1.1.0 (docs/ui.md "Appearance")
  corners?: 'square' | 'rounded'    // v1.1.0
  lastSeenVersion?: string          // v1.1.0: newest "What's new" shown on this PC
  yourName?: string                 // v1.1.0: signs emails ({{yourName}}); empty on a new install (docs/ui.md "Your name")
}
```

`currentTemplateId` is the template selected when the app last closed.
`gmailConnected` is still written so that v1.0.1 can read the data, but
v1.1.0 derives the connection state from Rust (`gmail_status`) at start-up.

## Loading and upgrading stored data

- **Loading:** zustand loads the stored state synchronously when the store
  module is created. The store's custom `merge` fills in defaults for settings
  that didn't exist when the data was written, which zustand's shallow merge
  would otherwise leave `undefined`.
- **Upgrading (`migrateStoredData` in the store):** runs on start-up.
  - `settings.dataRevision` (absent in v1.0.1 data) records which upgrades
    have been applied; the current revision is 1.
  - If the stored revision is older and there is user data, a
    `pre-migration` automatic backup is saved first (see [backup](backup.md)).
    The upgrade is applied only if that backup succeeded; otherwise it is
    retried on the next start. A fresh install has nothing to back up, so it
    just records the current revision.
- **Revision 1:** v1.0.1 stored the Google client ID and secret in plaintext
  in `settings`. The upgrade sets both fields to `''`. The fields are kept, so
  older versions still load the data, but someone who downgrades to v1.0.1
  would have to paste credentials again to use Gmail there.
- **Your name:** no upgrade sets `yourName`, so data from v1.0.1 has none
  until the user types it ([UI](ui.md#your-name)). v1.0.1 ignores the field
  and signs with its own hard-coded name.
- **Unusable lesson days:** a template whose `day` isn't one of the seven
  weekday names (possible only through damaged data) produces no invoice and
  is reported by Draft all, instead of reaching the invoice generator.

## Schema

The stored shape is described in zod in `app/src/lib/schema/index.ts`
(`persistedStateSchema`). Shared constants such as the weekday names, and
`isWeekday()`, the one check for a valid lesson day, live in
`app/src/lib/schema/constants.ts`, so code that only needs them doesn't pull in
zod. It is lenient, because unknown fields from newer
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
   (otherwise defaults would overwrite real data). This holds because loading
   is synchronous (localStorage).
5. Every upgrade goes in `migrateStoredData`, bumps `CURRENT_DATA_REVISION`,
   and is covered by `app/src/stores/app-store.test.ts`.
