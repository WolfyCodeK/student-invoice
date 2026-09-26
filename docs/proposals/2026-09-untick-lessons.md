# Proposal: untick a lesson that didn't happen

**Status:** approved for v1.1.0 (see Approval). Not implemented yet.
**Author:** 2026-09-26. **Requested by:** the teacher, via the owner, after seeing
the Register design. **Relates to:** decision 3 of the
[billing rules proposal](2026-09-billing-v1.1.md) ("let the teacher tick off any
individual date"), which this answers.

## What the teacher asked for

In the register, each pupil's row has one mark per lesson this half-term.
the teacher wants to untick a lesson that didn't happen (illness, a concert, a
holiday) and have that lesson's cost taken off the invoice.

## Proposed rule

1. **The marks are the lessons the app already charges.** Today every pupil
   is charged one lesson per week of the half-term: 8 in 1st half Autumn
   2026. The lesson dates are the first lesson day on or after the
   half-term's start, then every 7 days, which are the same dates the email's
   date range is built from. Each mark shows its date, e.g. "Mon 21 Sep".
2. **Click a mark to untick it** ("no lesson"); click again to tick it. All
   lessons start ticked.
3. **Lessons charged = ticked lessons.** Total = ticked lessons × cost per
   lesson. Nothing else in the calculation changes.
4. **The email wording does not change.** Only its figures do:
   - "Lessons: *N*" and "*N* x £cost = £total" use the ticked
     count (1 lesson reads "Lessons: 1", as the wording already does);
   - the date range runs from the first ticked lesson to the last ticked
     lesson.
5. **No lessons ticked:** that pupil's invoice can't be copied or drafted.
   The row says "No lessons ticked", and Draft All skips it and lists it as
   skipped.
6. **Unticks belong to one pupil and one half-term.** They are saved (they
   survive closing the app), they travel in exports and backups, and the next
   half-term starts with every lesson ticked. If the pupil's lesson day is
   changed, unticks for the old day no longer match any lesson and are
   dropped.
7. **Draft All, Copy and the preview** all use the ticked count.

## Worked examples (1st half Autumn term 2026, today's lesson-count rule)

Sarah (Oliver, piano, Monday, £25.00). Lessons: Mon 7, 14, 21, 28 Sep,
5, 12, 19, 26 Oct.

| Unticked | Lessons | Total | Date range in the email |
|---|---|---|---|
| none (today) | 8 | £200.00 | Monday 7th September to and including Monday 26th October |
| Mon 21 Sep | 7 | £175.00 | Monday 7th September to and including Monday 26th October |
| Mon 26 Oct | 7 | £175.00 | Monday 7th September to and including Monday 19th October |
| Mon 7 Sep | 7 | £175.00 | Monday 14th September to and including Monday 26th October |
| Mon 21 Sep and 28 Sep | 6 | £150.00 | Monday 7th September to and including Monday 26th October |

Priya (Amara and Tobi, guitar, Tuesday, £22.50). Lessons: Tue 1, 8, 15, 22,
29 Sep, 6, 13, 20 Oct.

| Unticked | Lessons | Total | Date range in the email |
|---|---|---|---|
| none (today) | 8 | £180.00 | Tuesday 1st September to and including Tuesday 20th October |
| Tue 1 Sep and Tue 20 Oct | 6 | £135.00 | Tuesday 8th September to and including Tuesday 13th October |

Sarah's email with Mon 26 Oct unticked (only the figures differ from today):

```
Hi Sarah,

Please find below the invoice for Oliver's piano lessons 1st half autumn term 2026.

Lessons: 7, from Monday 7th September to and including Monday 19th October

7 x £25.00 = £175.00

Many thanks,
the teacher
```

## Things the teacher will notice

- **Mon 26 Oct is in the half-term holiday.** Today's count rule charges
  Monday pupils for it (bug audit B1, decision 1 of the billing proposal,
  still pending). With dates on the marks this becomes visible, and the teacher can
  untick it. If decision 1 is later approved, Monday pupils would simply have 7
  marks, and unticking works the same way.
- The date range still spans the whole period even when a lesson in the
  middle is unticked (the Mon 21 Sep row above). The count and total are what
  change.

## Decisions for the owner

- **a. Approve the rule above?**
- **b. Which version:** v1.1.0 (with the redesign), or the version after it?
  v1.1.0 was going to change no calculation; this would be its one billing
  change.
- **c. A single remaining lesson** would read "from Monday 7th September to
  and including Monday 7th September". Leave it (rare), or say just "on
  Monday 7th September" in that case (a wording change)?

## Data and compatibility

- New optional template field `skippedLessonDates`: a list of ISO dates
  (e.g. `"2026-10-26"`). It is additive (see [data model](../data-model.md)).
  Dates from past half-terms never match again and are pruned when the
  template is saved.
- Going back to v1.0.1 ignores the field, so every lesson is charged again
  after a downgrade.
- Backups: the field is part of the template and travels in backup format 1.
  v1.1.0 is the first version with backups, and backup readers keep unknown
  template fields, so no format bump is needed. (This corrects the first
  draft, which assumed a bump.)
- Tests: with nothing unticked, output is byte-identical to today, and the
  characterization snapshots must not change. New tests cover every example
  in this proposal.

## Approval

Approved by the owner on 2026-09-26, in these words: "build the app with the
current v1.0.1 logic and with the new week deselecting system (which will
become v1.1.0), and then the teacher can use it and report back what he thinks,
then we'll do v1.1.1, v1.1.2, v1.1.3 etc until we've fine tuned it how he
wants."

- **a.** The rule is approved as written.
- **b.** It ships in v1.1.0. Every other calculation stays exactly as in v1.0.1.
- **c.** The wording stays unchanged, including the single-lesson date range,
  because the owner specified the v1.0.1 logic.

Later adjustments come from the teacher's feedback as v1.1.x patch releases. Each
money change still needs its own approved proposal.
