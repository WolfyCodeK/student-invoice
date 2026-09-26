# Billing rules

> **Owner approval required.** Any change that affects lesson counts, term
> dates, totals, cost handling or the dates quoted on an invoice must first be
> written up as a proposal in [proposals](proposals/README.md) with before/after
> examples and approved by the owner. The characterization tests below will
> fail on any such change, by design.

This page describes the rules exactly as implemented today (v1.0.1 logic).
Known problems with them are listed at the end; they are not fixed until a
proposal is approved.

## Where the logic lives

| What | Where |
|---|---|
| Term dates and "which term is it?" | `app/src/utils/terms.ts` (`getTermsForAcademicYear`, `calculateTermData`) |
| Lesson dates, totals, subject and body text | `app/src/utils/invoice-generator.ts` (`generateInvoice`) |
| When the current term is computed | once at start-up (`calculateCurrentTerm` in `app/src/stores/app-store.ts`) |
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

## Invoice text

- **Subject:** `Invoice for <Instrument capitalised> Lessons <half> half <season> term <start year>`,
  e.g. `Invoice for Bass guitar Lessons 1st half autumn term 2026`.
- **Body (default):** greeting to the recipient, the students' names and
  instrument, `Lessons: N, from <first lesson> to and including <last lesson>`,
  the calculation line `N x £cost = £total`, and the sign-off `Many thanks,` /
  `the teacher`. The exact text is pinned in the characterization test.
- **Custom body:** the user can replace the body in Settings. Placeholders:
  `{{recipient}}`, `{{students}}`, `{{instrument}}`, `{{termInfo}}`,
  `{{weeksCount}}`, `{{lessonCountText}}` (session/sessions), `{{dateRange}}`,
  `{{cost}}`, `{{totalCost}}`, `{{isAre}}` (is/are).

## Known issues (not yet changed — need approval)

See the [bug audit](audits/2026-09-bug-audit.md): **B1** (count is not the
number of actual lesson days, and the quoted range can run past the end of
term), **B2** (the last day of term counts as "outside term" after midnight),
**B3** (dates never change year to year), **B14** (cost validation and
floating-point totals).
