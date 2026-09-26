# Data model and storage

All user data lives in the WebView2 **localStorage** of the app's origin
`http://tauri.localhost`. On disk that is inside
`%LOCALAPPDATA%\com.isaac.student-invoice\EBWebView\`. There is no database,
no files written by the app, and nothing in the cloud.

> Dev builds (`pnpm tauri dev`) use the origin `http://localhost:3000`, so
> development data is separate from the installed app's data.

## localStorage keys

| Key | Written by | Contents |
|---|---|---|
| `student-invoice-store` | zustand `persist` in `app/src/stores/app-store.ts` | `{"state": {templates, currentTemplateId, settings, gmailConnected}, "version": 0}` |
| `student-invoice-theme` | `app/src/components/theme-provider.tsx` | `"light"` or `"dark"` |

The Gmail OAuth tokens are **not** stored; they are held in memory by the Rust
process (see [Gmail](gmail.md)).

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
  createdAt: Date                  // stored as ISO string; not revived to Date on load
  updatedAt: Date                  // stored as ISO string; not revived to Date on load
}

interface AppSettings {
  theme: 'light' | 'dark'           // fallback only; the theme key above wins
  emailMode: 'clipboard' | 'gmail-draft'   // unused
  defaultTemplateId?: string        // editable, unused
  windowPosition: { x, y }          // unused
  gmailClientId?: string
  gmailClientSecret?: string        // plaintext (security audit S3)
  autoSave: boolean                 // unused
  showNotifications: boolean        // editable, unused
  customEmailBodyTemplate?: string  // replaces the default email body
}
```

`currentTemplateId` is the template selected when the app last closed.
`gmailConnected` is persisted, but it is reset about a second after start-up
(bug audit B22).

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
   (otherwise defaults would overwrite real data).
