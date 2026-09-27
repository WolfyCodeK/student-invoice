# Decisions from the invoice rules review (for v1.1.0)

**Status:** approved for v1.1.0 (see Approval).
**Author:** 2026-09-27. **Decided by:** the owner, from the plain-English
rules review page prepared for going through the parked
[billing rules](2026-09-billing-v1.1.md) with the main user.

The review page asked nine questions. Five were settled for v1.1.0 and are
recorded here or in their own proposals; the other four wait for the main
user and a v1.1.x release (see [Still open](#still-open)).

## 1. Part of a penny (bug audit B14, B27)

**Before.** The total multiplies the stored price as it is. A price with
more than two decimals (possible only through imported data; the editor
refuses it) gives a sum that doesn't add up: £12.345 × 8 prints
"8 x £12.35 = £98.76".

**Rule.** The price is rounded to the penny first (the decimal as written,
so £12.345 becomes £12.35), and both the price and the total in the email
use it: "8 x £12.35 = £98.80". Anything that isn't a real price is refused
where it can enter: the editor accepts pounds and pence only, and an import
refuses negative or non-numeric prices.

| Price stored | Before | After |
|---|---|---|
| £25.00 | 8 x £25.00 = £200.00 | unchanged |
| £22.50 | 8 x £22.50 = £180.00 | unchanged |
| £12.345 | 8 x £12.35 = £98.76 | 8 x £12.35 = £98.80 |
| £19.999 | 8 x £20.00 = £159.99 | 8 x £20.00 = £160.00 |

## 2. Stray spaces (bug audit B30)

**Before.** A space typed at either end of a name reached the email: "Hi
Sarah ," or "Oliver 's piano lessons".

**Rule.** Spaces at either end of the name you greet and the pupils' names
are removed, when a family is saved and when the email is written (so
families saved earlier are fixed too). Spaces inside a name stay.

## 3. A new half-term while the app is open

**Before.** The current half-term was worked out once, at start-up. Left
open (or asleep) past the start of a new half-term, the app kept showing
the old one until restarted.

**Rule.** The app works the half-term out again just after midnight and
whenever its window comes back into view (including after the PC wakes).
Nothing changes if it's the same half-term.

## 4. "Lessons" everywhere (bug audit B29)

**Before.** The subject said "Lessons", the email said "sessions".

**Rule.** The email says "lesson" or "lessons". The `{{lessonCountText}}`
placeholder for custom wording gives "lesson"/"lessons" too. Wording a
teacher typed themselves is left as it is.

| | Before | After |
|---|---|---|
| Standard email | 8 sessions, 1st half autumn term 2026 … | 8 lessons, 1st half autumn term 2026 … |
| One lesson left | 1 session… | 1 lesson… |

This is the only change to the characterization snapshots: every changed
line differs by exactly that word.

## 5. The subject line

Kept as it is ("Invoice for Piano Lessons 1st half autumn term 2026").

## Decided elsewhere

- **Changing the term dates:** [editable term dates](2026-09-editable-term-dates.md).
- **The sign-off name:** [Your name](2026-09-your-name-sign-off.md). The
  main user types it once; the app has no name built in.

## Still open

For the main user, in a v1.1.x release: counting the real lesson days
(B1), bank holidays (B23), invoicing between half-terms (B2, B26), and how
the lesson dates read in the email.

## Approval

Approved by the owner in chat on 2026-09-27: "Yes, go ahead with all
three" (items 1 to 3), "Say 'lessons' everywhere" (item 4) and "Keep it as
it is" (item 5).
