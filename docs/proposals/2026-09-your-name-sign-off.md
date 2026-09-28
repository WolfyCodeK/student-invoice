# Proposal: sign emails with "Your name"

**Status:** approved for v1.1.0 (see Approval).
**Author:** 2026-09-27. **Requested by:** the owner.
**Relates to:** bug audit B25 ("the default email is signed with a hard-coded
name") and decision 5 of the [billing rules proposal](2026-09-billing-v1.1.md),
where the owner asked for names to be generic and filled in by the user.

## Problem

The built-in email wording ends with one teacher's first name, hard-coded.
Anyone else who installs the app sends invoices signed with someone else's
name, and the public code is written about one person. The app should be
generic, and each teacher's details should be their own data: stored on
their PC, kept in backups, and moved between PCs with Export and Import.

## Proposed rule

1. **A new setting, "Your name"**, in Settings under Email wording. It is
   empty on a new install and is used only to sign emails.
2. **The built-in wording ends with Your name** instead of the hard-coded
   name. Everything else in the email (greeting, figures, dates) is
   unchanged.
3. **A new placeholder, `{{yourName}}`**, is available for custom wording. The
   built-in wording that "Reset to default" restores uses it.
4. **Custom wording is left alone.** A teacher who saved their own wording
   keeps exactly what they wrote. If it doesn't use `{{yourName}}`, the app
   never asks for a name.
5. **No unsigned emails.** When the email needs Your name and it's empty,
   Copy email text, Save as Gmail draft and Draft all ask for the name first,
   then carry on. The register shows a reminder with a name field until one
   is set.
6. **After updating from v1.0.1**, What's new asks for the name once, with a
   field in the dialog. Nothing is filled in automatically.

## Before and after (built-in wording, last two lines)

| | Before | After |
|---|---|---|
| Sign-off | *(closing line)* / *(hard-coded first name)* | *(closing line)* / *(Your name)* |
| Your name empty | n/a | Copy, Save and Draft all ask for the name first |
| Custom wording saved | Unchanged | Unchanged |

Lesson counts, dates, costs, totals and the subject line do not change. The
characterization snapshots change only in their last line, which now shows
the test's made-up name.

The wording itself was made generic later, in v1.1.1
([proposal](2026-09-generic-standard-wording.md)).

## What users will notice

- The main user sees "Your name" requested once in What's new after
  updating, and types it. After that, emails look exactly as before.
- A new user is asked for their name before their first email goes out.

## Approval

Approved by the owner in chat on 2026-09-27, with two choices: the name is
typed once rather than filled in automatically, and the app asks for it
before any email goes out unsigned.
