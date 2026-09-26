# Billing rules

> **Owner approval required.** Any change that affects lesson counts, term
> dates, totals, cost handling or the dates quoted on an invoice must first be
> written up as a proposal in [proposals](proposals/README.md) with before/after
> examples and approved by the owner. The characterization tests below will
> fail on any such change, by design.

This page describes the rules exactly as implemented. They are v1.0.1's
logic plus two approved changes in v1.1.0: unticking a lesson that didn't
happen ([proposal](proposals/2026-09-untick-lessons.md)), and signing the
email with the user's own name instead of a hard-coded one
([proposal](proposals/2026-09-your-name-sign-off.md)). Known problems are
listed at the end; they are not fixed until a proposal is approved.

## Where the logic lives

| What | Where |
|---|---|
| Term dates and "which term is it?" | `app/src/utils/terms.ts` (`getTermsForAcademicYear`, `calculateTermData`) |
| Lesson dates, totals, subject and body text | `app/src/utils/invoice-generator.ts` (`lessonDates`, `generateInvoice`) |
| Unticking a lesson | `toggleLesson` in `app/src/stores/app-store.ts`; tests in `app/src/utils/untick-lessons.test.ts` |
| When the current term is computed | once at start-up (the store's initial `currentTerm`, from `calculateTermData(new Date())` in `app/src/stores/app-store.ts`) |
| Which invoice a screen or draft uses | `invoiceFor(template, term, wording)` in `app/src/stores/app-store.ts`: `generateInvoice` for the current term with the email wording settings (the custom body and Your name), or none outside term time or for an invalid lesson day |
| Whether an email can go out yet | `needsYourName()` in `app/src/stores/app-store.ts`: true while the wording uses `{{yourName}}` and no name is set ([UI](ui.md#your-name)) |
| Locked-in expected output | `app/src/utils/billing.characterization.test.ts` and its snapshots in `app/src/utils/__snapshots__/` |

## Term dates

An academic year starting in autumn of year *Y* has six half-terms. The dates
are the same every year:

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

## Lesson count and total

- `weeksCount = ceil((end − start) / 7 days)`, computed from the term's start and
  end instants. It is the **same for every weekday**: 8, 7, 6, 5, 6, 7 for the six
  half-terms respectively (all years 2023–2032 checked).
- **Total = weeksCount × cost per lesson** (cost as entered, in pounds, floating
  point, shown with 2 decimals).
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
  match a lesson (from past half-terms, or from before the lesson day was
  changed). Dates that don't match are ignored by the calculation anyway.
- With nothing unticked, the output is byte-identical to v1.0.1, and the
  characterization snapshots prove it.

## Invoice text

- **Subject:** `Invoice for <Instrument capitalised> Lessons <half> half <season> term <start year>`,
  e.g. `Invoice for Bass guitar Lessons 1st half autumn term 2026`.
- **Body (default):** greeting to the recipient, the students' names and
  instrument, `Lessons: N, from <first lesson> to and including <last lesson>`,
  the calculation line `N x £cost = £total`, and the sign-off `Many thanks,` /
  `{{yourName}}`. The exact text is pinned in the characterization test,
  which signs with a made-up name.
- **Your name (v1.1.0):** the sign-off used to be a hard-coded first name.
  It is now the "Your name" setting, trimmed, passed as the last argument of
  `generateInvoice(template, term, customBody?, yourName = '')`
  ([proposal](proposals/2026-09-your-name-sign-off.md)). It is empty on a new
  install and after updating from v1.0.1, and no email is copied or drafted
  while the wording needs it and it's empty ([UI](ui.md#your-name)). This
  resolves bug audit B25.
- **Custom body:** the user can replace the body in Settings. Placeholders:
  `{{recipient}}`, `{{students}}`, `{{instrument}}`, `{{termInfo}}`,
  `{{weeksCount}}`, `{{lessonCountText}}` (session/sessions), `{{dateRange}}`,
  `{{cost}}`, `{{totalCost}}`, `{{isAre}}` (is/are), `{{yourName}}` (Your
  name, inserted literally, so `$&` in a name stays as typed). Custom wording
  saved before v1.1.0 is left exactly as it was.

## Known issues (deferred to a future version)

The owner decided on 2026-09-26 that **v1.1.0 does not change any calculation,
email wording or way of using the app**, apart from the two approved changes
above. Other changes will be made in a later
version, after consulting the main user. The analysis and options are in the
[billing proposal](proposals/2026-09-billing-v1.1.md). The issues are listed
in the [bug audit](audits/2026-09-bug-audit.md):

- **B1:** the count is not the number of actual lesson days, and the quoted
  range can run past the end of term.
- **B2:** the last day of term counts as "outside term" after midnight.
- **B3:** the dates never change from year to year.
- **B14:** cost validation, and floating-point totals.
- **B23:** bank holidays are billed.
- **B26:** there are no invoices between half-terms.
- **B27:** costs with more than 2 decimals.
- **B29, B31:** wording.
