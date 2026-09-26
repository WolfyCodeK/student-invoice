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
- **Move your data to another PC:** Settings → Your data → Export, then
  Import on the other PC. It includes templates, settings, the email wording
  and the theme.
- **Automatic backups:** a copy of your data is saved every day, and before
  imports and updates. You can restore any of them from Settings.

### Changed
- Connecting Gmail is simpler: no more pasting a client ID and secret into
  Settings. Click **Connect Gmail**, choose your account in the browser, and
  you stay connected, even after closing the app.
- The app now only asks Google for permission to manage drafts. It no longer
  asks to read your mailbox.
- Settings shows which Gmail account is connected. Advanced users can still
  use their own Google OAuth client.
- The installer is now pinned to its existing identity, so updates always
  replace the installed app in place.

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
