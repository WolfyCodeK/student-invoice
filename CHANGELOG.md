# Changelog

All notable changes to Student Invoice. Versions follow `MAJOR.MINOR.PATCH`,
where MAJOR means a completely new product, MINOR a major change and PATCH a
minor change (see `docs/compatibility.md`).

Each released version's section becomes that version's GitHub release notes.
The `latest-json-summary` comment is the one-line summary installed apps show
in the update prompt. It must stay plain: letters, digits, spaces and
`. , : ; ( ) / # + _ -` only (see `docs/compatibility.md`).

## [Unreleased]

### Security
- Removed a Google sign-in credential that had been published by mistake in the
  project's source history, and replaced it with a new one.
- The app no longer reads settings from a `.env` file on the computer at start-up.

### Changed
- The installer is now pinned to its existing identity, so updates always
  replace the installed app in place.

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
