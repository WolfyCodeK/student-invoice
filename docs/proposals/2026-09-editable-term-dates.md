# Proposal: editable term dates

**Status:** approved for v1.1.0 (see Approval).
**Author:** 2026-09-27. **Requested by:** the owner, for v1.1.0.
**Relates to:** decision 2 of the [billing rules proposal](2026-09-billing-v1.1.md)
("Editable per year", chosen then deferred) and bug audit B3 (term dates are
the same every year).

## Problem

The six half-term dates are fixed in the code and repeat every year
(1 Sep to 25 Oct, 3 Nov to 20 Dec, and so on). Real schools move them from
year to year, so invoices can count the wrong weeks, and the only fix today
is a new release.

## Proposed rule

1. **Settings → Term dates becomes editable.** For **this school year and the
   next** (so next year's dates can be entered in the summer), each
   half-term's first and last day can be changed with a date picker.
   Anything the teacher never changes keeps today's dates.
2. **Reset to the usual dates** puts a year back to today's dates.
3. **The calculation does not change.** The app uses the edited dates exactly
   where it uses today's dates now:
   - which half-term "now" is, and the register's weeks;
   - the number of lessons (the weeks between the first and last day,
     rounded up, as today);
   - the lesson dates (every 7 days from the first lesson day on or after the
     first day, as today) and so the email's figures and date range.

   Today's known quirks (audit B1, B2) stay as they are until the rules review
   with the main user.

   **Clarification (2026-09-27, while building it):** the weeks are counted in
   whole calendar days. The old code measured milliseconds, so edited dates
   spanning the October clock change would gain an hour and could count one
   lesson too many (for example 1 September to Tuesday 27 October: 8 weeks,
   but 9 lessons). With the usual dates both ways give exactly the same
   results, which the characterization snapshots confirm (bug audit B24).
4. **Checks before saving:** each half-term's last day is on or after its
   first day, the six are in order without overlapping, and all fall between
   1 August of the school year and 31 August of the next.
5. **Unticked lessons belong to dates.** If new dates move a family's lessons,
   an untick for a date that is no longer a lesson stops counting (and is
   dropped the next time that family's lessons change).
6. **Data:** saved as a new optional `settings.termDates`, holding only the
   years the teacher changed. It is included in exports and backups, and
   v1.0.1 ignores it (after a downgrade it uses today's dates).

## Worked examples (1st half autumn 2026, computed with the current code)

| Dates | Monday family, £25 a lesson | Friday family, £26 a lesson |
|---|---|---|
| Today's: Tue 1 Sep to Sun 25 Oct | 8 lessons, 7 Sep to 26 Oct, **£200** | 8 lessons, 4 Sep to 23 Oct, **£208** |
| Edited: Thu 3 Sep to Fri 23 Oct | 8 lessons, 7 Sep to 26 Oct, **£200** | 8 lessons, 4 Sep to 23 Oct, **£208** |
| Edited: Thu 3 Sep to Fri 16 Oct (a two-week break) | 7 lessons, 7 Sep to 19 Oct, **£175** | 7 lessons, 4 Sep to 16 Oct, **£182** |

With no edits, every invoice is exactly as today; the characterization
snapshots don't change.

## What users will notice

- Settings → Term dates has date boxes and "Reset to the usual dates"
  instead of a read-only list.
- After changing a date, the register, totals and emails follow straight
  away.

## Approval

Approved as written by the owner in chat on 2026-09-27: this school year and
the next are editable, and the calculation rules stay exactly as today.
