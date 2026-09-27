# User interface

The UI follows the **Register** design direction, chosen by the owner on
2026-09-26 from the design review. The direction contract lives in
`.impeccable/surfaces/app-src-app-tsx.md`, and the design system will be
recorded in `DESIGN.md` at the end of the redesign.

One frameless window shows one screen at a time, under the app's own title
bar. The stack is React with plain CSS on design tokens (no Tailwind), Radix
primitives for dialogs, selects, switches and toasts
(`app/src/components/ui/`), and `lucide-react` icons.

## Structure

| Part | Where |
|---|---|
| Shell: title bar, current screen, app-wide dialogs (including "Discard your changes?"), start-up data upgrade and backup | `app/src/App.tsx` |
| Update checks (`useUpdates`) and the update dialog | `app/src/features/updates/` |
| Navigation and shared actions (`useAppActions`), and the unsaved-changes check (`useLeaveGuard`) | `app/src/features/app-context.tsx` |
| Title bar | `app/src/components/title-bar.tsx` |
| Register (main screen) | `app/src/features/register/` |
| Settings | `app/src/features/settings/` |
| Adding or editing a family | `app/src/features/family/` |
| What's new and the guided tour | `app/src/features/onboarding/` |
| Your name: the name box (`your-name-field.tsx`), and the check and dialog that ask for it before an email goes out (`use-your-name.tsx`) | `app/src/features/your-name/` |
| Gmail sign-in dialog and the shared Connect Gmail action | `app/src/features/gmail/` |
| Feedback form | `app/src/components/feedback-form.tsx` |
| Crash screen | `app/src/components/error-boundary.tsx` |
| Styles | `app/src/styles/`: `fonts.css`, `tokens.css`, `base.css`, `app.css` (loaded at start-up); each screen loaded on demand has its own: `features/settings/settings.css`, `features/family/family-editor.css`, `features/onboarding/tour.css` |
| Display helpers | `app/src/lib/format.ts` (money, lesson counts), `app/src/lib/term-display.ts` (half-term names, ranges and comparisons) |

The screens are `register`, `settings` and `edit` (a family, or `null` for a new one). Settings, the editor, the
feedback form and the onboarding pieces load on first use, and are prefetched
when the app is idle ([performance](performance.md)).

## Title bar

The window has no Windows frame (`decorations: false`). The title bar is
drawn by the app, in the manner of Discord's: it reads as part of the app,
not as Windows chrome.

- **Colour:** register blue, continuing into the blue header band below.
- **Left:** a back arrow on screens other than the register, then the app
  icon and name.
- **Centre:** where you are: "Register", or a breadcrumb such as
  "Register › Settings" or "Register › Priya" on other screens. The band
  below carries the full heading.
- **Right:**
  - Help (starts the tour);
  - Check for updates (a refresh arrow; it becomes an "Update ready" pill
    when one is available). An update the release marks as important opens
    the update dialog at every start, with "This is an important update";
    "Not now" still closes it ([architecture](architecture.md#updates));
  - Feedback;
  - Settings;
  - then a divider and thin minimise, maximise/restore and close buttons.
    Close turns red on hover, as in Windows 11.
- **Moving the window:** empty areas carry `data-tauri-drag-region`, so they
  drag the window, and double-clicking one maximises it. The window
  permissions this needs are listed in [security](security.md).

## Register

The main screen (`register-view.tsx`) has three parts.

**Header band.**
- The heading "Register · <half-term>", the dates and the number of weeks.
- A strip of the school year's six half-terms, with the current one filled.
- Gmail status, and **Draft all N in Gmail**. The status is the live one
  from Rust: "Checking Gmail…" until it answers (Draft all waits too), then
  the connected address, or Connect Gmail. When the button is disabled, a
  line under it gives the reason. N counts the families with at least one
  ticked lesson.

**The register grid.**
- One row per family: the recipient, then pupils and instrument. The
  lesson day has its own column, or is folded into the family line in
  narrow windows.
- One column per calendar week, from the week the half-term starts to the
  week of the last lesson charged (`weeks.ts`). A week wholly after the
  half-term ends is hatched, except where a lesson is drawn: today's rule can
  still charge a Monday lesson there, and the legend and tooltip say so
  (see [billing](billing.md)).
- The page stays ruled below the last family, like a register.
- **Marks are buttons.** Each lesson charged has a mark in its week, dated in
  its tooltip. Clicking a mark unticks the lesson (dashed circle, not
  charged); clicking again ticks it
  ([billing](billing.md#unticked-lessons-v110)).
- Then Lessons ("7 of 8" when some are unticked), Per lesson and Total.
  Figures come from `generateInvoice`, so they always match the email.
- A red double margin rule runs between the family and the weeks.
- With Gmail not connected, **Connect Gmail** is the strong button in the
  band and Draft all steps back.
- Below the grid: Add a family, Edit, Delete… (with confirmation), and a
  legend.
- **Locked while saving to Gmail:** while drafts are being saved, the marks
  and Add, Edit and Delete are disabled, with "Families and lessons can't be
  changed while saving to Gmail."

**The pupil's page** (`pupil-page.tsx`), beside the grid.
- The selected family's lessons × cost = total, and which lessons aren't
  charged.
- The subject with **Copy subject**, and the full email.
- **Copy email text** and **Save as Gmail draft**, each disabled with a
  reason when it can't be used (for Save as Gmail draft, "Checking the Gmail
  connection…" until Rust has answered).
- Until Your name is set (and the wording uses it), a reminder with the name
  box ([Your name](#your-name)).

**Draft all.**
- The pupil's page closes and a status column appears.
- Each family moves through Saving…, Draft saved, Not saved (with the reason
  and **Try again**), Not tried, or Nothing to invoice, as it happens. A
  connection or network error stops the run, and the families after it show
  Not tried ([Gmail](gmail.md#creating-a-draft)).
- The results are kept in the store (`draftResults`), so they stay until
  **Close results**, even if you go to Settings and back. **Try again**
  drafts that one family and updates its row.
- The band then says how many drafts were saved, counting only families
  still on the register. While any family with something to invoice isn't
  saved yet, **Draft the remaining N in Gmail** drafts only those: saved
  families are never drafted twice, and families with nothing to invoice
  stay that way.
- With Gmail disconnected (say after a `ReauthRequired` error), the band
  offers **Connect Gmail**, and Draft the remaining and every **Try again**
  are disabled until it is connected ("Connect Gmail first").

**Other states.**
- **No families:** the three steps of how the app works, with **Add your
  first family** and **Connect Gmail**.
- **Outside term time:** a note, the date the next half-term starts, and no
  marks or totals. Draft buttons are disabled with the reason.
- **Narrow windows** (container queries on the register): the Day and Per
  lesson columns fold away, and the weeks narrow.

## Connecting Gmail

Every Connect Gmail button (the register band, the empty register, Draft
all's results and Settings) uses `useConnectGmail` (`features/gmail/`).
While the browser sign-in runs, the "Connect Gmail" dialog
(`connect-dialog.tsx`) shows the steps and **Cancel**; a toast then says how
it went, and cancelling says nothing. If the window is reloaded during
sign-in (F5), Rust is still waiting, so the dialog comes back and stays until
the sign-in ends ([Gmail](gmail.md#status-and-disconnect)).

## Settings

A full page (`features/settings/`) with a section list on the left. Changes
are saved straight away, except the email wording, which has its own Save
button. The sections:

- **Appearance:** see [Appearance](#appearance) below.
- **Gmail:** status, Connect or Disconnect, and the *Advanced* custom Google
  OAuth client ([gmail](gmail.md)).
- **Email wording:** the Your name box at the top
  ([Your name](#your-name)), then the custom body with placeholders, and a
  button to go back to the standard wording
  ([billing](billing.md#invoice-text)).
- **Term dates:** the school year's half-terms, read-only, with the current
  one marked.
- **Your data:** export, import, automatic backups and restore
  ([backup](backup.md)).
- **Performance:** Low memory mode. "Currently on/off" is what the running
  window was started with, as Rust reports it; the switch shows the saved
  choice, and **Restart now** appears while the two differ
  ([performance](performance.md#low-memory-mode)).
- **About & help:** the version, Check for updates, **Show the tour again**
  and Send feedback.

The old "Show notifications" and "Default template" settings did nothing and
are gone. Their stored fields are left untouched.

## Your name

The standard email wording ends `Many thanks,` / `{{yourName}}`, filled from
`settings.yourName` ([billing](billing.md#invoice-text),
[proposal](proposals/2026-09-your-name-sign-off.md)). It is empty on every
install, including an update from v1.0.1, and nothing fills it in: the
teacher types it once. Custom wording is left as the user saved it, and if it
doesn't use `{{yourName}}` the name is never asked for.

- **Where it's set:** Settings → Email wording, at the top. The same box
  (`YourNameField`) is used wherever the name is asked for. The placeholder
  list describes `{{yourName}}` as "Your name, from the box above".
- **Asked for first:** while the wording in use contains `{{yourName}}` and
  no name is set, Copy email text, Save as Gmail draft, Draft all and a
  draft's **Try again** first open "Add your name first", with the box and
  **Save and carry on**, then continue (`useYourNameGate`). The store also
  refuses to draft without it (`needsYourName()` and `YOUR_NAME_NEEDED` in
  `app/src/stores/app-store.ts`), so nothing goes out unsigned.
- **Reminder:** until it's set, the pupil's page shows "Add your name to
  sign your emails." with the box (`useNeedsYourName`).
- **What's new:** while the name is missing (as after updating from v1.0.1),
  What's new adds "Your emails now end with your name. Type it once and
  every email uses it." with the box.

## Adding or editing a family

`features/family/` is a form page. Its fields are the name you greet, the
pupils, the instrument (fixed list, plus the family's own if it isn't on it),
the lesson day and the cost per lesson. It has the same validation as
v1.0.1, and every field has a plain hint (`family-form.ts`).

- **Cost:** a number greater than £0 in pounds and pence. More than two
  decimal places is refused with "Use pounds and pence, e.g. 22.50.", as
  v1.0.1's number field (`step="0.01"`) did (bug audit B27).
- **Length limits:** the name you greet and the pupils stop typing at the
  import limits (`MAX_LENGTH` in `app/src/lib/schema/constants.ts`), as do
  the email wording and the Your name box, so every export can be imported
  again ([backup](backup.md#import)).
- A live preview of this half-term's invoice sits beside the form.
- Saving keeps anything else on the family, such as unticked lessons, except
  that changing the lesson day drops the unticks
  ([billing](billing.md#unticked-lessons-v110)).
- Delete sits in a separate danger zone ("Removes this family from the
  register. A backup is saved first.") and asks for confirmation.

**Deleting a family** (`delete-family-dialog.tsx`, from the editor or the
register) says "This removes … from the register. A backup is saved first,
so you can restore it from Settings, under Your data." **Delete** shows
"Deleting…" while the store's `deleteFamily` saves a `pre-delete` automatic
backup ([backup](backup.md#automatic-backups)); only then is the family
removed. If the backup fails, nothing is deleted and the dialog stays open
with "Nothing was deleted, because the backup couldn't be saved." and the
reason.

## Unsaved changes

Screens with unsaved changes register a check with `useLeaveGuard`
(`features/app-context.tsx`): the family editor while any field differs from
what it opened with (`hasChanges`), and Settings while the email wording
differs from the saved text. While one does, leaving through `navigate`,
`back` or `startTour` (the back arrow, Settings and Help in the title bar)
first asks "Discard your changes?", with **Keep editing** and **Discard**
(`App.tsx`).

- **Not asked:** the editor's Cancel, Save and Delete, which leave on
  purpose.
- **Not guarded:** closing the window, installing an update, and the Your
  name box (it saves on its own button).

## What's new and the tour

`features/onboarding/` handles both, in this order:
- **What's new** shows once, the first time the app opens after an update.
  It has only changes a user would notice, in a few short lines
  (`whats-new.ts`). While Your name is missing, it also asks for it
  ([Your name](#your-name)).
- **The guided tour** follows only after the v1.1.0 update. It dims
  everything except one highlighted area, with numbered steps in the order
  a teacher works at half-term (`tour-steps.ts`). Its targets are the `data-tour` attributes
  on the register and title bar. The Help button and Settings → **Show the
  tour again** replay it.
- **Later updates** show What's new only.
- **Fresh installs** see neither; the empty register explains the steps
  instead.
- `settings.lastSeenVersion` records what has been shown
  ([data model](data-model.md)).

## Appearance

There are three independent switches. Each is saved in settings and applied
as an attribute on `<html>`, which `app/src/styles/tokens.css` reads.

| Switch | Values | Stored in |
|---|---|---|
| Colours (`data-scheme`) | `student-invoice` (register blue, Atkinson Hyperlegible Next) or `navy-amber` ("Navy and amber": navy and amber with the softer Nunito lettering) | `settings.colourScheme` |
| Corners (`data-corners`) | `square` (default) or `rounded` (pill buttons, 8/14/22 px panels) | `settings.corners` |
| Light or dark (`data-mode`) | `light` (default) or `dark` | the `student-invoice-theme` key and `settings.theme`, as in v1.0.1 |

- **Lettering follows the colour scheme.**
- **No flash:** `app/index.html` applies the saved values before the first
  paint.
- **One place for all three:** `app/src/lib/appearance.ts` reads, applies
  and saves them. They are applied once per change: by `app/index.html` at
  start-up, by `setAppearance` in the store when the user picks one, and by
  `replaceAllData` after an import or restore.
- **Fonts:** bundled in `app/src/assets/fonts/` (SIL OFL, Latin and Latin
  Extended only). A face downloads only when it's used, so the Navy and
  amber fonts (Nunito) load only with that scheme.

Components use only the tokens: no literal colours, radii or fonts. The
selection colour, focus rings and scrollbars are themed too.

## Toasts

`app/src/hooks/use-toast.ts` holds the current toast: one at a time, a new
one replacing the last. Code shows one by calling `toast()` directly, so
firing a toast doesn't re-render the caller. `components/toaster.tsx`
renders it with the styled Radix toast in `components/ui/toast.tsx`. Toasts
close after 5 seconds, which is Radix Toast's default (bug audit B34),
unless the toast sets its own `duration` in milliseconds.

- **"Your saved data couldn't be read":** shown once at start-up if the
  stored data had to be set aside ([data model](data-model.md#loading-and-upgrading-stored-data)).
  It uses `duration: Infinity`, so it stays until closed. It says the app
  started empty and a copy was kept, or, when there was no room for a copy,
  that changes won't be saved; either way it points to restoring an automatic
  backup in Settings, under Your data.

## Errors

`app/src/components/error-boundary.tsx` wraps the app (in
`app/src/main.tsx`). If rendering fails, it shows "Something went wrong" with
the message, **Reload** and **Open backups folder**. Because the window has
no frame, it draws its own bar with a Close button.

## Window

- **Size:** 1280×800 by default, reduced at start-up to fit the screen's free
  area (`fit_to_screen` in `app/src-tauri/src/lib.rs`). The minimum is
  960×600.
- **Behaviour:** resizable, maximisable and snappable, with no Windows frame.
- **Configuration:** `app/src-tauri/tauri.conf.json`. The window is created
  in Rust (see [architecture](architecture.md)).
