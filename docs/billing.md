# Billing rules

> **Owner approval required.** Any change that affects lesson counts, term
> dates, totals, cost handling or the dates quoted on an invoice must first be
> written up as a proposal in [proposals](proposals/README.md) with before/after
> examples and approved by the owner. The characterization tests below will
> fail on any such change, by design.

This page describes the rules exactly as implemented. They are v1.0.1's
logic plus these approved changes in v1.1.0:

- unticking a lesson that didn't happen ([proposal](proposals/2026-09-untick-lessons.md));
- signing the email with the user's own name instead of a hard-coded one
  ([proposal](proposals/2026-09-your-name-sign-off.md));
- term dates that can be edited in Settings ([proposal](proposals/2026-09-editable-term-dates.md));
- a price rounded to the penny, names without stray spaces, "lessons"
  instead of "sessions", and noticing a new half-term while the app is open
  ([proposal](proposals/2026-09-rules-review-decisions.md)).

In v1.1.1 the standard email wording became generic; only the wording
changed, not the figures ([proposal](proposals/2026-09-generic-standard-wording.md)).

Known problems are listed at the end; they are not fixed until a proposal is
approved.

## Where the logic lives

| What | Where |
|---|---|
| Term dates and "which term is it?" | `app/src/utils/terms.ts` (`getTermsForAcademicYear`, `calculateTermData`, both taking the edited dates from `settings.termDates`) |
| Editing term dates | Settings → Term dates (`app/src/features/settings/terms-group.tsx`; checks in `termDatesProblem`, saving in `withTermDates`, `app/src/features/settings/settings-logic.ts`) |
| Lesson dates, totals, subject and body text | `app/src/utils/invoice-generator.ts` (`lessonDates`, `generateInvoice`) |
| Unticking a lesson | `toggleLesson` in `app/src/stores/app-store.ts`, and `updateTemplate` there, which drops unticks when the lesson day changes; tests in `app/src/utils/untick-lessons.test.ts` and `app/src/stores/app-store.test.ts` |
| When the current term is computed | at start-up (with the saved term dates), whenever the term dates change, and again just after midnight and whenever the window comes back into view (`refreshCurrentTerm` in `app/src/stores/app-store.ts`) |
| Which invoice a screen or draft uses | `invoiceFor(template, term, wording)` in `app/src/stores/app-store.ts`: `generateInvoice` for the current term with the email wording settings (the custom body and Your name), or none outside term time or for an invalid lesson day |
| Whether an email can go out yet | `needsYourName()` in `app/src/stores/app-store.ts`: true while the wording uses `{{yourName}}` and no name is set ([UI](ui.md#your-name)) |
| Locked-in expected output | `app/src/utils/billing.characterization.test.ts` and its snapshots in `app/src/utils/__snapshots__/` (figures and dates read through a neutral test line, `{{weeksCount}} {{lessonCountText}}, {{dateRange}}`, so they don't depend on the wording); the v1.1.0 decisions in `app/src/utils/billing-decisions.test.ts` |

## Term dates

An academic year starting in autumn of year *Y* has six half-terms. These
are the usual dates, used for every year unless they were edited:

| Half-term | Start | End |
|---|---|---|
| Autumn 1st half | 1 Sep *Y* | 25 Oct *Y* |
| Autumn 2nd half | 3 Nov *Y* | 20 Dec *Y* |
| Spring 1st half | 5 Jan *Y+1* | 14 Feb *Y+1* |
| Spring 2nd half | 23 Feb *Y+1* | 28 Mar *Y+1* |
| Summer 1st half | 13 Apr *Y+1* | 23 May *Y+1* |
| Summer 2nd half | 1 Jun *Y+1* | 18 Jul *Y+1* |

"Today" is in a term when `start ≤ now ≤ end`, where both dates are midnight
(00:00) local time. Outside every term, no invoice is generated.

**Edited dates (v1.1.0).** Settings → Term dates can change the first and
last day of each half-term for this school year and the next
([proposal](proposals/2026-09-editable-term-dates.md)). They are stored as
`settings.termDates` (only the years that differ from the usual dates) and
used exactly where the usual dates would be; every rule on this page is
unchanged. Before saving, every date must be filled in, each half-term must
end on or after its first day, the six must be in order without
overlapping, and all must fall between 1 August of the school year and 31
August of the next. A stored year that can't be read (damaged data) falls
back to the usual dates.

## Lesson count and total

- `weeksCount = ceil(calendar days from start to end / 7)`. It is the **same
  for every weekday**: 8, 7, 6, 5, 6, 7 for the six half-terms respectively
  with the usual dates (all years 2023–2032 checked). Counting whole calendar
  days (rather than milliseconds, as v1.0.1 did) gives exactly the same results
  for the usual dates, and stops a clock change inside edited dates adding a
  lesson (bug audit B24).
- **Total = weeksCount × price per lesson**, where the price is first rounded
  to the penny as written (`roundToPenny`: £12.345 becomes £12.35, an ordinary
  price is unchanged), so the email's sum always adds up. Shown with 2
  decimals.
- First lesson = the first date on or after the term start that falls on the
  template's weekday. Last lesson = first lesson + (weeksCount − 1) weeks.
  These `weeksCount` dates are the half-term's **lessons** (`lessonDates`).

## Unticked lessons (v1.1.0)

Approved in [untick lessons](proposals/2026-09-untick-lessons.md).

- Each lesson can be unticked when it didn't happen. It is stored on the
  template as its date in `skippedLessonDates` ("yyyy-MM-dd").
- **Lessons charged** = the lessons that are still ticked. **Total** =
  lessons charged × cost per lesson. `N` in the text below is lessons charged.
- The date range quotes the first and last *ticked* lessons. The wording is
  unchanged, including a single lesson ("from Monday 7th September to and
  including Monday 7th September").
- **Nothing ticked:** that invoice can't be drafted or copied, and Draft All
  skips it and names it.
- `toggleLesson` accepts only a date that is one of the current half-term's
  lessons for that template. While saving, it drops unticks that no longer
  match a lesson (from past half-terms). Dates that don't match are ignored
  by the calculation anyway.
- **Changing the lesson day** (`updateTemplate`, when the family editor
  saves a different day) keeps only the unticks that match the new day's
  lessons this half-term. Those never share a date with the old day's, so in
  practice every untick is dropped, and changing the day back later doesn't
  bring them back. This is the proposal's rule that unticks for the old day
  are dropped.
- With nothing unticked, the output is byte-identical to v1.0.1, and the
  characterization snapshots prove it.

## Invoice text

- **Subject:** `Invoice for <Instrument capitalised> Lessons <half> half <season> term <start year>`,
  e.g. `Invoice for Bass guitar Lessons 1st half autumn term 2026`.
- **Names** have spaces at either end removed (when a family is saved, and
  again when the email is written, so older families are fixed too).
- **Body (standard wording, v1.1.1):** the same text as
  `getDefaultTemplateString()`, generic and not any one teacher's
  ([proposal](proposals/2026-09-generic-standard-wording.md)):

  ```
  Hi {{recipient}},

  Please find below the invoice for {{students}}'s {{instrument}} lessons, {{termInfo}}.

  Lessons: {{weeksCount}}, from {{dateRange}}
  Cost per lesson: £{{cost}}
  Total: £{{totalCost}}

  Many thanks,
  {{yourName}}
  ```

  `{{dateRange}}` reads `<first lesson> to and including <last lesson>`, e.g.
  `Thursday 3rd September to and including Thursday 22nd October`. The exact
  text is pinned by an inline snapshot in the characterization test, which
  signs with a made-up name. Up to v1.1.0 the standard wording was one
  teacher's own; that teacher now keeps it as their custom wording.
- **Your name (v1.1.0):** the sign-off used to be a hard-coded first name.
  It is now the "Your name" setting, trimmed, passed as the last argument of
  `generateInvoice(template, term, customBody?, yourName = '')`
  ([proposal](proposals/2026-09-your-name-sign-off.md)). It is empty on a new
  install and after updating from v1.0.1, and no email is copied or drafted
  while the wording needs it and it's empty ([UI](ui.md#your-name)). This
  resolves bug audit B25.
- **Custom body:** the user can replace the body in Settings. Placeholders:
  `{{recipient}}`, `{{students}}`, `{{instrument}}`, `{{termInfo}}`,
  `{{weeksCount}}`, `{{lessonCountText}}` (lesson/lessons), `{{dateRange}}`,
  `{{cost}}`, `{{totalCost}}`, `{{isAre}}` (is/are), `{{yourName}}` (Your
  name, inserted literally, so `$&` in a name stays as typed). Custom wording
  saved before v1.1.0 is left exactly as it was.

## Known issues (deferred to a future version)

The owner decided on 2026-09-26 that **v1.1.0 does not change any calculation,
email wording or way of using the app**, apart from the approved changes
above. The rest will be settled with the main user for a v1.1.x release. The analysis and options are in the
[billing proposal](proposals/2026-09-billing-v1.1.md). The issues are listed
in the [bug audit](audits/2026-09-bug-audit.md):

- **B1:** the count is not the number of actual lesson days, and the quoted
  range can run past the end of term.
- **B2:** the last day of term counts as "outside term" after midnight.
- **B3:** fixed in v1.1.0: the dates can be edited per school year.
- **B14:** prices are rounded to the penny before multiplying (v1.1.0);
  totals are still floating point, shown to 2 decimals.
- **B23:** bank holidays are billed.
- **B26:** there are no invoices between half-terms.
- **B27:** fixed in v1.1.0: the family editor refuses more than 2 decimals,
  as v1.0.1's did (`costProblem` in `app/src/features/family/family-form.ts`),
  and a price that arrives with more (imported data) is rounded to the penny.
- **B29:** fixed in v1.1.0: "lessons" everywhere. **B31** (the subject
  doesn't name the pupil): decided to keep the subject as it is.
