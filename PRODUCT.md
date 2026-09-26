# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Private music teachers in the UK.** Today one teacher, the main user,
  uses it. He bills each student's family once per half-term.
- The main user's computer confidence is basic. Things must be obvious.
  Jargon, hidden menus and unclear errors will confuse him.
- The owner, Isaac (GitHub: WolfyCodeK), builds, supports and releases the
  app. He is not an end user.
- Other teachers may use it later. That is undecided, so nothing in the app
  or the code is specific to one teacher: each teacher's details (such as
  the name that signs the emails) are their own data on their own PC.

## Product Purpose

Student Invoice turns one saved template per student or family into a
ready-to-send half-term invoice email. A template holds the recipient, the
cost per lesson, the instrument, the lesson day and the student names. The app
works out the current half-term, the number of lessons, the date range and
the total, and writes the email. The email is then either copied to the
clipboard or saved as a Gmail draft, one at a time or all at once.

Success means that at each half-term the teacher produces every invoice
correctly in one short sitting, with nothing to calculate or retype by hand.

## Positioning

It is not general invoicing or accounting software. It knows UK school
half-terms and weekly lessons, so the whole job is: open it at half-term,
check, draft all, send from Gmail. It runs locally on the teacher's own PC.
Nothing leaves it except the drafts saved to his own Gmail.

## Operating Context

- **Rhythm:** used in bursts about six times a year, at each half-term
  (Autumn, Spring and Summer, 1st and 2nd half). In between, the app goes
  unopened for weeks, so every session starts cold.
- **One sitting:** open the app, check the current half-term, update
  templates for new students or price changes, **Draft All** to Gmail, then
  review the drafts in Gmail and send them there. The app never sends mail
  itself.
- **Machine:** a Windows 10/11 desktop app (Tauri v2, UI in WebView2). Screens
  range from 1366×768 laptops to 4K at 150% scaling. It is installed from
  GitHub releases and updates itself via the in-app **Updates** button.
- **Time of day:** whenever he gets a chance, by day or at night, so both
  light and dark must be first-class.
- **Data:** everything stays on the PC. It can be exported and imported to
  another PC, and is backed up automatically.

## Capabilities and Constraints

**Capabilities (v1.1.0):**
- templates: add, edit and delete;
- half-term detection, and the year's term dates in Settings;
- an invoice preview with copy buttons for the subject and body;
- Gmail: connect (drafts permission only), draft one or all, with the reason
  for each failure;
- a custom email body with placeholders;
- a "Your name" setting that signs every email;
- export, import and automatic backups;
- two colour schemes, square or rounded corners, and light and dark mode;
- a feedback form;
- in-app updates;
- Low memory mode.

**Constraints:**
- v1.1.0 keeps v1.0.1's calculations and email wording (`docs/billing.md`).
  The exceptions are the approved **untick a lesson that didn't happen**
  (`docs/proposals/2026-09-untick-lessons.md`) and the sign-off, which is
  now the user's own name (`docs/proposals/2026-09-your-name-sign-off.md`).
- After v1.1.0, the main user uses the app and reports back. It is then
  fine-tuned to his wishes in v1.1.x patch releases, and each money change
  still needs an approved proposal
  (`docs/proposals/2026-09-billing-v1.1.md`). The owner approved
  (2026-09-26) rearranging the main screen in the redesign if that makes it
  simpler, as long as every existing function stays.
- Installed copies must keep updating and keep their data
  (`docs/compatibility.md`). Changes to stored data are additive only.
- It must stay lightweight and fast (`docs/performance.md` budgets).

**Terminology:** template (one per student or family), recipient,
half-term, lessons (called "sessions" in the email), **Draft All**.

**Undecided:** whether other teachers will use it. The emails are signed
with the teacher's own "Your name" setting, which each teacher types once
(`docs/proposals/2026-09-your-name-sign-off.md`).

## Brand Commitments

- **Name:** Student Invoice. The icon is a stack of invoices with a tick
  (`app/src-tauri/icons/`, vector master `app/src/assets/app-icon.svg`).
- **Voice:** plain, friendly British English with no jargon, like the email
  itself ("Hi …, Please find below the invoice for …") and the changelog.
- **Binding requests from the owner:**
  - a custom title bar in the style of Discord's instead of the standard
    Windows one;
  - two selectable colour schemes: the app's own, and Navy and amber, with
    softer lettering;
  - light and dark mode;
  - the app must feel lightweight, fast and smooth;
  - the design must not look like generic AI output;
  - **The main user likes the corporate accounting-software look.**
    Professional, businesslike finance software suits him. This is his
    taste, not something to design away.

## Evidence on Hand

- The real email subject and wording: `app/src/utils/invoice-generator.ts`.
  The exact outputs are locked in `app/src/utils/__snapshots__/`.
- The Navy and amber scheme's palette: navy #2e4c6d, amber #c98a34, and
  Nunito lettering (`app/src/styles/tokens.css`).
- There are no screenshots of real student data, no testimonials and no usage
  data. Designs must use clearly fictional students, families and fees.

## Product Principles

1. **Nothing to work out by hand.** The app does the half-term, the lesson
   count and the total. The teacher checks them; he doesn't calculate.
2. **Obvious after weeks away.** The next step must be visible without
   remembering anything.
3. **Never lose or silently change money or data.** Correctness and backups
   come before features, and money changes need the owner's approval.
4. **Light and quiet.** It is a small, fast desktop tool that stays out of the
   way.
5. **Reviewed before sent.** Invoices become drafts or copied text. Sending is
   always the teacher's own step.

## Accessibility & Inclusion

- It is designed for basic computer confidence:
  - clear, large targets;
  - plain labels;
  - errors that say what happened and what to do next.
- It must work at 1366×768 and with Windows display scaling of 150% or more.
- It must be usable with the keyboard, with readable contrast in every theme.
  No formal standard has been set.
