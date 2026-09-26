# User interface

The UI is a single window with one screen plus dialogs, all in
`app/src/App.tsx`. It uses Tailwind CSS 3, hand-copied shadcn/ui-style
components in `app/src/components/ui/` (built on Radix primitives), and
`lucide-react` icons.

## Screen layout

- **Loading screen:** shown for a fixed 800 ms on start.
- **Header:** app name, version (from `getVersion()`), and the light/dark
  theme toggle.
- **Left panel, "Invoice Generator" card:**
  - the template picker (one template per student/family);
  - New, Edit and Delete buttons;
  - the selected template's details;
  - the invoice total and lesson count.
- **Left panel, "Actions & Status" card:**
  - counters for templates, Gmail status and the current term's week count;
  - Draft Email, Draft All, Copy Subject and Copy Body. Draft buttons are
    disabled outside term time, when Gmail isn't connected, and while drafts
    are being created (they show a spinner);
  - Connect Gmail, or when connected "Connected as <email>" and Disconnect
    Gmail. If this build has no Google client, the button says so and is
    disabled;
  - Settings;
  - the Updates button (highlighted when an update is available).
- **Right panel:** the "Email Preview" (subject and body) for the selected
  template, and below it a "Send Feedback" button. With no template selected,
  or outside term time, the preview explains why it is empty.

## Dialogs

| Dialog | Where | Purpose |
|---|---|---|
| Template form | `app/src/components/template-form.tsx` | Create or edit a template: recipient, cost, instrument (fixed list), day (Mon–Sun), students. Validated with zod and react-hook-form. The form resets every time it opens. Names are trimmed and limited to 200 characters (recipient) and 500 (students). |
| Settings | `app/src/components/settings-dialog.tsx` | Notifications switch (unused), default template (unused), email body editor, Gmail status with an *Advanced* section for a custom Google OAuth client (saved immediately to Credential Manager, separate from the dialog's Save), "Your data" (export, import, automatic backups; see [backup](backup.md)), read-only term dates for the current academic year. |
| Email body editor | same file (`EmailBodyEditorDialog`) | Edit the custom body with placeholders; see [billing](billing.md#invoice-text). |
| Connect Gmail (while the browser sign-in is pending, with Cancel), Draft results (lists each failed student and why), Delete Template, Software Update (shows download progress; can't be closed while installing), Feedback | `app/src/App.tsx` | The Feedback form (`FeedbackForm`) sends a message through EmailJS (max 5,000 characters). |

## Errors

`app/src/components/error-boundary.tsx` wraps the app (in `app/src/main.tsx`).
If rendering fails, it shows "Something went wrong" with the error message,
a Reload button and a button to open the automatic backups folder, instead of
a blank window.

## Theme

`app/src/components/theme-provider.tsx` applies a `light`/`dark` class to
`<html>` and stores the choice in the `student-invoice-theme` localStorage
key. The toggle is in `app/src/components/theme-toggle.tsx`. Colours are CSS
variables in `app/src/App.css`.

## Toasts

`app/src/hooks/use-toast.ts` is the shadcn toast store, showing one toast at
a time. `App.tsx` renders it. Toasts close after 5 seconds, which is Radix
Toast's default duration. The store's own removal timer is disabled, and a
comment in `use-toast.ts` wrongly suggests toasts never auto-close (bug audit
B34).

## Window

1500×940 px, centred, not maximizable, with minimum and maximum height both
fixed at 940 px (bug audit B16). Configured in `app/src-tauri/tauri.conf.json`.
