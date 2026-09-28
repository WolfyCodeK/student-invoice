# Proposal: a generic standard email wording

**Status:** approved for v1.1.1 (see Approval).
**Author:** 2026-09-28. **Requested by:** the owner.
**Relates to:** [Sign emails with Your name](2026-09-your-name-sign-off.md),
which made the sign-off the user's own; this does the same for the rest of the
standard wording.

## Problem

The standard email wording (what the app uses when a teacher hasn't written
their own) was one teacher's personal wording, written for them. It was in
the code, in the tests, in a proposal's worked example and in the README
screenshots. The repo should be generic, and one person's wording should be
their own data, like their name.

## Proposed rule

1. **New standard wording**, used when the Email wording box is empty and
   restored by "Reset to the standard wording":

   ```
   Hi {{recipient}},

   Please find below the invoice for {{students}}'s {{instrument}} lessons, {{termInfo}}.

   Lessons: {{weeksCount}}, from {{dateRange}}
   Cost per lesson: £{{cost}}
   Total: £{{totalCost}}

   Many thanks,
   {{yourName}}
   ```

2. **Only the wording changes.** Lesson counts, dates, costs, totals and the
   subject line are worked out exactly as before, and the placeholders are
   the same.
3. **Custom wording is left alone.** A teacher who saved their own wording
   keeps it. Every placeholder, including `{{isAre}}` and
   `{{lessonCountText}}`, still works in it.
4. **The main user keeps their wording as their own data.** After updating,
   they paste their previous wording into Settings → Email wording once. It
   is then kept in their data and moved with Export and Import. A copy is
   kept privately outside the repo.
5. **The tests don't use anyone's wording.** They read the figures and dates
   through a neutral line of test wording, and the standard wording is
   pinned once, in the characterization test's inline snapshot.

## Before and after (Sam, bass guitar, Thursday, £22.50, 1st half autumn 2026)

| | Before | After |
|---|---|---|
| Opening | a personal sentence introducing the invoice | `Please find below the invoice for Sam's bass guitar lessons, 1st half autumn term 2026.` |
| Figures | a sentence, then `N x £cost = £total` | `Lessons: 8, from Thursday 3rd September to and including Thursday 22nd October` / `Cost per lesson: £22.50` / `Total: £180.00` |
| Sign-off | a personal closing, then Your name | `Many thanks,` then Your name |
| Lessons, dates, total | 8, 3 Sep to 22 Oct, £180.00 | the same |
| Subject | `Invoice for Bass guitar Lessons 1st half autumn term 2026` | the same |

**The characterization snapshots.** The saved results
(`app/src/utils/__snapshots__/billing-v1.0.1.txt`) used to quote the figures
sentence of the old wording. They now show the same figures through the
neutral test line `{{weeksCount}} {{lessonCountText}}, {{dateRange}}`. A
script compared the file before and after this change: all 840 invoice rows
have the same day, cost, lesson count, total, "lesson"/"lessons" and date
range, and the other 61 lines are byte-identical. The term-boundaries
snapshot is unchanged.

## What users will notice

- Anyone using the standard wording sees the new text from v1.1.1. The
  figures are the same.
- The main user pastes their previous wording once (see rule 4). Until then
  their emails use the new standard wording, with the same figures.

## Approval

Approved by the owner in chat on 2026-09-28, with three choices: use the
wording above, the main user pastes their own wording once after updating,
and git history is left as it is. Released in v1.1.1 the same day.

Later that day the owner chose to remove the old wording from the history
as well: the git history was rewritten (the old wording's lines replaced by
generic ones in every commit, and the old README screenshots removed) and
force-pushed with all version tags, and the installers of v1.0.0, v1.0.1
and v1.1.0 were taken off their release pages
([compatibility](../compatibility.md#things-that-would-break-older-installs-dont)).
