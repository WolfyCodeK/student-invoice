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
- **A new look: the register.** Every family is on one screen for the
  half-term, with a mark for each lesson and the total at the end of the
  row. Click a family to see its invoice email beside it.
- **Choose how it looks:** in Settings, pick the Student Invoice colours or
  Navy and amber, square or rounded corners, and light or dark.
- **A new title bar** that's part of the app, with buttons for Help, Updates,
  Feedback and Settings. The window can now be resized, maximised and
  snapped, and it fits smaller laptop screens.
- **What's new** appears once after each update. After this update, a short
  guided tour shows how everything works; replay it any time from the
  question mark or Settings.
- **Draft all shows each family's progress**, and one that failed can be
  tried again on its own.
- A new app icon.
- **Move your data to another PC:** Settings → Your data → Export, then
  Import on the other PC. It includes templates, settings, the email wording
  and the theme.
- **Automatic backups:** a copy of your data is saved every day, and before
  imports and updates. You can restore any of them from Settings.
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
  some drafts fail, the app lists which students failed and why.
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
  through installing.

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
