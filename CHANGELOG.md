# Changelog

All notable changes to Student Invoice. Versions follow `MAJOR.MINOR.PATCH`,
where MAJOR means a completely new product, MINOR a major change and PATCH a
minor change (see `docs/compatibility.md`).

Each released version's section becomes that version's GitHub release notes.
The `latest-json-summary` comment is the one-line summary installed apps show
in the update prompt. It must stay plain: letters, digits, spaces and
`. , : ; ( ) / # + _ -` only (see `docs/compatibility.md`).

## [Unreleased]

### Added
- **Paid and Thanks:** two tick boxes for each family on the register,
  beside the lesson day, for who has paid and who you've sent a thank-you.
- **A half-term total** at the bottom of the register: the lessons, what's
  paid, what's outstanding and the total, with "3 of 6 paid".
- **Every half-term is kept.** Open an earlier one from the half-term buttons
  in the blue band (the arrows change the school year) to see each family,
  every lesson, what was charged, and the Paid and Thanks ticks, which can
  still be ticked. A half-term is saved as it changes, and once it ends it
  stays exactly as it was, whatever changes later. Half-terms before this
  version are worked out from your families and prices, and say so. The
  history is never deleted, goes in every backup and export, and Import and
  Restore add to it rather than replace it.
- **Settings → How lessons are charged**, with three options, all off to
  begin with, so nothing changes unless you turn one on: only charge lessons
  inside the half-term; don't charge lessons on bank holidays (tick one on
  the register to charge it if the lesson went ahead); and in the holidays,
  show the next half-term, ready to invoice.

### Changed
- The app says **Drums** instead of Drum. Emails still say "drum lessons".
- **Term dates** shows one school year: the current one, moving on to the
  next on 1 August. The dates start as the app's best guess, so check them
  against your school's calendar. "Reset to the usual dates" has gone,
  because half-term dates change every year.

- The window can't be made quite as narrow as before (1040 pixels instead
  of 960), so the register never has to scroll sideways, and it folds its
  columns sooner as the window narrows.

### Fixed
- The app icon's paper is centred on its blue tile, in the taskbar and
  everywhere else, with the same size as before.

## [1.1.1] - 2026-09-28
<!-- latest-json-summary: Student Invoice 1.1.1: a new standard email wording, with the same figures -->

### Changed
- **New standard email wording:** "Please find below the invoice for …",
  then the lessons and dates, the cost per lesson and the total, each on its
  own line. Lesson counts, dates and totals are exactly as before, and your
  own wording, if you saved some, is kept. To keep using the previous
  wording, paste it into Settings → Email wording.
- **When an update is ready**, the Updates button in the title bar gets a
  small dot instead of turning into a wide "Update ready" button, and a
  notice in the bottom corner says so when the app starts. Install it from
  the notice, or later from the Updates button; nothing is forced.

## [1.1.0] - 2026-09-28
<!-- latest-json-summary: Student Invoice 1.1.0: a new look, untick missed lessons, editable term dates and automatic backups -->

### Added
- **A new look: the register.** Every family is on one screen for the
  half-term, with a mark for each lesson and the total at the end of the
  row. Click a family to see its invoice email beside it.
- **Choose how it looks:** in Settings, pick the Student Invoice colours or
  Navy and amber, square or rounded corners, and light or dark. After this
  update, you can try them on your own register before the tour starts.
- **Your school's term dates:** if they differ from the usual ones, change
  them in Settings → Term dates, for this school year and the next. The
  register and the emails follow straight away.
- **A new title bar** that's part of the app, with buttons for Help, Updates,
  Feedback and Settings. The window can now be resized, maximised and
  snapped, and it fits smaller laptop screens.
- **What's new** appears once after each update. After this update, a short
  guided tour shows how everything works; replay it any time from the
  question mark or Settings.
- **Draft all shows each family's progress**, and one that failed can be
  tried again on its own. The results stay until you close them, even if you
  leave the register, and **Draft the remaining** saves only the families
  not saved yet.
- A new app icon.
- **Move your data to another PC:** Settings → Your data → Export, then
  Import on the other PC. It includes templates, settings, the email wording
  and the theme.
- **Automatic backups:** a copy of your data is saved every day, and before
  imports and updates. You can restore any of them from Settings.
- **Deleting a family saves a backup first**, so it can be restored from
  Settings. If the backup can't be saved, nothing is deleted.
- You're asked before unsaved changes to a family or the email wording are
  discarded.
- **Untick a lesson that didn't happen:** click a lesson in the register to
  take it off that family's invoice (for illness, a concert or a holiday).
  The lesson count, total and dates in the email follow. Click it again to put
  it back. Each half-term starts with every lesson ticked.
- **Low memory mode:** Settings → Performance. The app uses about 40% less
  memory, at the cost of slightly less smooth scrolling on high-resolution
  screens. It's off by default and applies after a restart.

### Changed
- **Emails are signed with your name.** Add it once in Settings → Email
  wording (you're asked the first time you copy or save an email); it
  replaces the name the emails used to end with. Wording you wrote yourself
  is left as it is, and `{{yourName}}` puts your name in it.
- Settings is now a full page, and changes are saved straight away. The
  "Show notifications" and "Default template" settings, which did nothing,
  are gone.
- Connecting Gmail is simpler: no more pasting a client ID and secret into
  Settings. Click **Connect Gmail**, choose your account in the browser, and
  you stay connected, even after closing the app.
- The app now only asks Google for permission to manage drafts. It no longer
  asks to read your mailbox.
- Settings shows which Gmail account is connected. Advanced users can still
  use their own Google OAuth client.
- The installer is now pinned to its existing identity, so updates always
  replace the installed app in place.
- Opening the app while it's already open brings the open window to the
  front, instead of starting a second copy.
- The cost per lesson takes pounds and pence only (e.g. 22.50), as before.
- Emails say "lessons" instead of "sessions" ("7 lessons…"),
  and so does `{{lessonCountText}}` in your own wording.
- The email wording editor has **Undo changes** (or **Reset to the standard
  wording**) to throw away edits you haven't saved.

### Performance
- Starts noticeably faster: the app is ready in about half a second. The
  fixed loading screen is gone.
- Smaller download and program size, and no light/dark flash when the app
  opens.

### Fixed
- Cancelling or failing Google sign-in no longer leaves the app stuck on
  "Waiting for authentication", and you can try again straight away.
- Sign-in works on PCs whose antivirus or network inspects secure
  connections.
- "Draft All" can no longer create duplicate drafts when clicked twice. If
  some drafts fail, the app lists which families failed and why.
- Error messages now say what actually went wrong, instead of always "check
  your Gmail connection".
- Draft buttons are disabled outside term time, rather than failing.
- The email preview updates straight away after you edit a template or the
  email wording, and it clears when a template is deleted.
- Accented names and the £ sign display correctly in Gmail drafts.
- Editing a template always starts from its saved values. Previously,
  details from an earlier or cancelled edit could reappear and be saved.
- If something unexpected goes wrong, the app shows a way forward instead
  of a blank window.
- The update window shows download progress and can't be closed halfway
  through installing. A stalled download now gives up with a message
  instead of waiting forever.
- If your saved data can't be read, it is kept rather than overwritten, and
  the app tells you how to restore a backup.
- A price with part of a penny (such as one from an imported file) is
  rounded to the penny, so the sum in the email always adds up.
- Spaces typed before or after a name no longer show in the email.
- The app notices when a new half-term starts while it's left open, or while
  the PC sleeps.
- Settings and the family editor open without a blank moment the first time.
- While you scroll Settings, the list on the left marks every section in
  turn, and choosing one near the end brings it to the top.

### Security
- Removed a Google sign-in credential that had been published by mistake in the
  project's source history, and replaced it with a new one.
- Gmail sign-in tokens are kept in Windows Credential Manager, and the old
  plaintext Google credentials are removed from the app's settings.
- Sign-in is protected against another program or web page intercepting or
  faking it.
- The app window is locked down: it can only reach the services it needs and
  only run the app's own code.
- The app no longer reads settings from a `.env` file on the computer at start-up.

## [1.0.1] - 2026-02-05
<!-- latest-json-summary: Student Invoice 1.0.1 -->

### Fixed
- Spring and summer terms are now recognised from January to July. Previously
  the app looked at the wrong academic year and showed "outside term time".

### Added
- Settings now lists this academic year's term dates and highlights the
  current half-term.

## [1.0.0] - 2025-10-06

First release of Student Invoice.

### Added
- Invoice templates per student or family: recipient, cost per lesson,
  instrument, lesson day and student names.
- Automatic half-term detection and invoice generation, with the lesson count,
  date range and total.
- A preview of the invoice email, with one-click copy of the subject and body.
- Gmail integration: sign in with Google and save invoices as Gmail drafts, one
  at a time or all at once.
- A custom email body with placeholders.
- Light and dark themes.
- An in-app feedback form.
- In-app updates: the Updates button downloads and installs new versions
  automatically.
