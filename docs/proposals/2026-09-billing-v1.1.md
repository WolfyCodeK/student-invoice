# Proposal: billing rules for v1.1.0

**Status:** deferred to a future version. On 2026-09-26 the owner decided that
v1.1.0 does not change any calculation, email wording or way of using the
app. The decisions below will be revisited after consulting the main user
(the teacher), and none of them is implemented in v1.1.0.

**Preliminary positions recorded on 2026-09-26 (not final):**

| # | Decision | Outcome |
|---|---|---|
| 1 | Lesson count rule | **Pending**: checking with the teacher. Money logic unchanged until then. |
| 2 | Term dates | **Approved**: editable per academic year in Settings, with today's dates as defaults. |
| 3 | Bank holidays / days off | **Pending**: checking with the teacher. |
| 4 | Invoicing between half-terms | **Pending**: checking with the teacher. |
| 5 | Sign-off name | **Approved**: no hard-coded names anywhere. There is a "Your name" setting, empty on a fresh install; data upgraded from v1.0.1 is pre-filled with "the teacher" so existing emails are unchanged. |
| 6 | Subject wording / pupil name | **Pending**: checking with the teacher. |

**Note on decision 2:** with editable dates, today's week formula (milliseconds ÷ 7 days) can be thrown off by clock changes (e.g. 1 Oct → 5 Nov gives 6, not 5). Whatever rule decision 1 settles on must count calendar days. For today's fixed dates, counting calendar days gives exactly the same results (checked 2023–2040), and the characterization snapshots prove it.
**Author:** 2026-09-26. **Evidence:** bug audit B1, B2, B3, B23, B26
([audit](../audits/2026-09-bug-audit.md)) and the characterization snapshots
in `app/src/utils/__snapshots__/`.

Nothing here is implemented. After approval, the chosen rules are
implemented, the characterization snapshots are regenerated in the same
commit, and each changed line is checked against the tables below.

## The problem in one paragraph

Today the lesson count is the number of *weeks* a half-term spans, rounded
up, and it is the same for every weekday. Because the hard-coded half-terms
are always a few days more than a whole number of weeks, early-week pupils
are billed one lesson more than actually fall inside the half-term. The
quoted date range then ends on a day after the half-term has finished (in
2026, Monday pupils' autumn range ends "Monday 26th October", the first day
of half-term). Over the ten academic years 2023/24–2032/33 the current rule
bills **one lesson too many in 57 of 420** weekday/half-term combinations,
and **never too few**. In the current academic year, 2026/27, Monday pupils
are over-billed in every half-term.

Separately, on the last day of each half-term the app says "outside term"
from 00:00:01, so no invoice can be produced that day (B2).

## Decisions needed

1. **Lesson count (recommended).** A lesson is billed for every date from the
   first day to the last day of the half-term, **inclusive**, that falls on
   the pupil's lesson day. The total stays count × cost per lesson. The date
   range quotes the first and last of those dates. The last day of term
   counts as in term all day. Table A shows every change for 2026/27 and
   2027/28.
2. **Term dates.** Keep today's fixed dates as the defaults, but let them be
   edited per academic year in Settings (e.g. from the school's published
   calendar). Changing a date changes the counts for that half-term only.
3. **Bank holidays (optional).** Leave England & Wales bank holidays out of
   the count and the date range when they fall on a lesson day. Table B lists
   the affected dates. Alternatively, let the teacher tick off any individual date
   ("no lesson") per half-term, which also covers INSET days, illness and
   concerts.
4. **Between half-terms (optional).** During a holiday, allow preparing the
   *next* half-term's invoices (e.g. during late August for Autumn ½1).
5. **Sender name.** Make the sign-off a setting, defaulting to "the teacher", so
   existing emails are unchanged.
6. **Wording.** Keep "sessions" in the email and "lessons" in the subject, or
   choose one. Optionally name the pupil in the subject (e.g. "Invoice for
   Sam's Piano Lessons …") so Gmail drafts are easy to tell apart.

## Table A: lesson counts, current vs proposed (decision 1, with today's fixed term dates)

### Academic year 2026/27

| Half-term | Day | Current count | Proposed count | Current dates | Proposed dates |
|---|---|---|---|---|---|
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Monday | 8 | 7 **(-1)** | Mon 7 Sept – Mon 26 Oct | Mon 7 Sept – Mon 19 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Tuesday | 8 | 8 | Tue 1 Sept – Tue 20 Oct | Tue 1 Sept – Tue 20 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Wednesday | 8 | 8 | Wed 2 Sept – Wed 21 Oct | Wed 2 Sept – Wed 21 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Thursday | 8 | 8 | Thu 3 Sept – Thu 22 Oct | Thu 3 Sept – Thu 22 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Friday | 8 | 8 | Fri 4 Sept – Fri 23 Oct | Fri 4 Sept – Fri 23 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Saturday | 8 | 8 | Sat 5 Sept – Sat 24 Oct | Sat 5 Sept – Sat 24 Oct |
| Autumn ½1 2026 (Tue 1 Sept–Sun 25 Oct) | Sunday | 8 | 8 | Sun 6 Sept – Sun 25 Oct | Sun 6 Sept – Sun 25 Oct |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Monday | 7 | 6 **(-1)** | Mon 9 Nov – Mon 21 Dec | Mon 9 Nov – Mon 14 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Tuesday | 7 | 7 | Tue 3 Nov – Tue 15 Dec | Tue 3 Nov – Tue 15 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Wednesday | 7 | 7 | Wed 4 Nov – Wed 16 Dec | Wed 4 Nov – Wed 16 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Thursday | 7 | 7 | Thu 5 Nov – Thu 17 Dec | Thu 5 Nov – Thu 17 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Friday | 7 | 7 | Fri 6 Nov – Fri 18 Dec | Fri 6 Nov – Fri 18 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Saturday | 7 | 7 | Sat 7 Nov – Sat 19 Dec | Sat 7 Nov – Sat 19 Dec |
| Autumn ½2 2026 (Tue 3 Nov–Sun 20 Dec) | Sunday | 7 | 7 | Sun 8 Nov – Sun 20 Dec | Sun 8 Nov – Sun 20 Dec |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Monday | 6 | 5 **(-1)** | Mon 11 Jan – Mon 15 Feb | Mon 11 Jan – Mon 8 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Tuesday | 6 | 6 | Tue 5 Jan – Tue 9 Feb | Tue 5 Jan – Tue 9 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Wednesday | 6 | 6 | Wed 6 Jan – Wed 10 Feb | Wed 6 Jan – Wed 10 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Thursday | 6 | 6 | Thu 7 Jan – Thu 11 Feb | Thu 7 Jan – Thu 11 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Friday | 6 | 6 | Fri 8 Jan – Fri 12 Feb | Fri 8 Jan – Fri 12 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Saturday | 6 | 6 | Sat 9 Jan – Sat 13 Feb | Sat 9 Jan – Sat 13 Feb |
| Spring ½1 2027 (Tue 5 Jan–Sun 14 Feb) | Sunday | 6 | 6 | Sun 10 Jan – Sun 14 Feb | Sun 10 Jan – Sun 14 Feb |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Monday | 5 | 4 **(-1)** | Mon 1 Mar – Mon 29 Mar | Mon 1 Mar – Mon 22 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Tuesday | 5 | 5 | Tue 23 Feb – Tue 23 Mar | Tue 23 Feb – Tue 23 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Wednesday | 5 | 5 | Wed 24 Feb – Wed 24 Mar | Wed 24 Feb – Wed 24 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Thursday | 5 | 5 | Thu 25 Feb – Thu 25 Mar | Thu 25 Feb – Thu 25 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Friday | 5 | 5 | Fri 26 Feb – Fri 26 Mar | Fri 26 Feb – Fri 26 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Saturday | 5 | 5 | Sat 27 Feb – Sat 27 Mar | Sat 27 Feb – Sat 27 Mar |
| Spring ½2 2027 (Tue 23 Feb–Sun 28 Mar) | Sunday | 5 | 5 | Sun 28 Feb – Sun 28 Mar | Sun 28 Feb – Sun 28 Mar |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Monday | 6 | 5 **(-1)** | Mon 19 Apr – Mon 24 May | Mon 19 Apr – Mon 17 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Tuesday | 6 | 6 | Tue 13 Apr – Tue 18 May | Tue 13 Apr – Tue 18 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Wednesday | 6 | 6 | Wed 14 Apr – Wed 19 May | Wed 14 Apr – Wed 19 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Thursday | 6 | 6 | Thu 15 Apr – Thu 20 May | Thu 15 Apr – Thu 20 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Friday | 6 | 6 | Fri 16 Apr – Fri 21 May | Fri 16 Apr – Fri 21 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Saturday | 6 | 6 | Sat 17 Apr – Sat 22 May | Sat 17 Apr – Sat 22 May |
| Summer ½1 2027 (Tue 13 Apr–Sun 23 May) | Sunday | 6 | 6 | Sun 18 Apr – Sun 23 May | Sun 18 Apr – Sun 23 May |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Monday | 7 | 6 **(-1)** | Mon 7 Jun – Mon 19 Jul | Mon 7 Jun – Mon 12 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Tuesday | 7 | 7 | Tue 1 Jun – Tue 13 Jul | Tue 1 Jun – Tue 13 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Wednesday | 7 | 7 | Wed 2 Jun – Wed 14 Jul | Wed 2 Jun – Wed 14 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Thursday | 7 | 7 | Thu 3 Jun – Thu 15 Jul | Thu 3 Jun – Thu 15 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Friday | 7 | 7 | Fri 4 Jun – Fri 16 Jul | Fri 4 Jun – Fri 16 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Saturday | 7 | 7 | Sat 5 Jun – Sat 17 Jul | Sat 5 Jun – Sat 17 Jul |
| Summer ½2 2027 (Tue 1 Jun–Sun 18 Jul) | Sunday | 7 | 7 | Sun 6 Jun – Sun 18 Jul | Sun 6 Jun – Sun 18 Jul |

### Academic year 2027/28

| Half-term | Day | Current count | Proposed count | Current dates | Proposed dates |
|---|---|---|---|---|---|
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Monday | 8 | 8 | Mon 6 Sept – Mon 25 Oct | Mon 6 Sept – Mon 25 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Tuesday | 8 | 7 **(-1)** | Tue 7 Sept – Tue 26 Oct | Tue 7 Sept – Tue 19 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Wednesday | 8 | 8 | Wed 1 Sept – Wed 20 Oct | Wed 1 Sept – Wed 20 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Thursday | 8 | 8 | Thu 2 Sept – Thu 21 Oct | Thu 2 Sept – Thu 21 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Friday | 8 | 8 | Fri 3 Sept – Fri 22 Oct | Fri 3 Sept – Fri 22 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Saturday | 8 | 8 | Sat 4 Sept – Sat 23 Oct | Sat 4 Sept – Sat 23 Oct |
| Autumn ½1 2027 (Wed 1 Sept–Mon 25 Oct) | Sunday | 8 | 8 | Sun 5 Sept – Sun 24 Oct | Sun 5 Sept – Sun 24 Oct |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Monday | 7 | 7 | Mon 8 Nov – Mon 20 Dec | Mon 8 Nov – Mon 20 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Tuesday | 7 | 6 **(-1)** | Tue 9 Nov – Tue 21 Dec | Tue 9 Nov – Tue 14 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Wednesday | 7 | 7 | Wed 3 Nov – Wed 15 Dec | Wed 3 Nov – Wed 15 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Thursday | 7 | 7 | Thu 4 Nov – Thu 16 Dec | Thu 4 Nov – Thu 16 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Friday | 7 | 7 | Fri 5 Nov – Fri 17 Dec | Fri 5 Nov – Fri 17 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Saturday | 7 | 7 | Sat 6 Nov – Sat 18 Dec | Sat 6 Nov – Sat 18 Dec |
| Autumn ½2 2027 (Wed 3 Nov–Mon 20 Dec) | Sunday | 7 | 7 | Sun 7 Nov – Sun 19 Dec | Sun 7 Nov – Sun 19 Dec |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Monday | 6 | 6 | Mon 10 Jan – Mon 14 Feb | Mon 10 Jan – Mon 14 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Tuesday | 6 | 5 **(-1)** | Tue 11 Jan – Tue 15 Feb | Tue 11 Jan – Tue 8 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Wednesday | 6 | 6 | Wed 5 Jan – Wed 9 Feb | Wed 5 Jan – Wed 9 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Thursday | 6 | 6 | Thu 6 Jan – Thu 10 Feb | Thu 6 Jan – Thu 10 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Friday | 6 | 6 | Fri 7 Jan – Fri 11 Feb | Fri 7 Jan – Fri 11 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Saturday | 6 | 6 | Sat 8 Jan – Sat 12 Feb | Sat 8 Jan – Sat 12 Feb |
| Spring ½1 2028 (Wed 5 Jan–Mon 14 Feb) | Sunday | 6 | 6 | Sun 9 Jan – Sun 13 Feb | Sun 9 Jan – Sun 13 Feb |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Monday | 5 | 5 | Mon 28 Feb – Mon 27 Mar | Mon 28 Feb – Mon 27 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Tuesday | 5 | 5 | Tue 29 Feb – Tue 28 Mar | Tue 29 Feb – Tue 28 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Wednesday | 5 | 5 | Wed 23 Feb – Wed 22 Mar | Wed 23 Feb – Wed 22 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Thursday | 5 | 5 | Thu 24 Feb – Thu 23 Mar | Thu 24 Feb – Thu 23 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Friday | 5 | 5 | Fri 25 Feb – Fri 24 Mar | Fri 25 Feb – Fri 24 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Saturday | 5 | 5 | Sat 26 Feb – Sat 25 Mar | Sat 26 Feb – Sat 25 Mar |
| Spring ½2 2028 (Wed 23 Feb–Tue 28 Mar) | Sunday | 5 | 5 | Sun 27 Feb – Sun 26 Mar | Sun 27 Feb – Sun 26 Mar |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Monday | 6 | 6 | Mon 17 Apr – Mon 22 May | Mon 17 Apr – Mon 22 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Tuesday | 6 | 6 | Tue 18 Apr – Tue 23 May | Tue 18 Apr – Tue 23 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Wednesday | 6 | 5 **(-1)** | Wed 19 Apr – Wed 24 May | Wed 19 Apr – Wed 17 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Thursday | 6 | 6 | Thu 13 Apr – Thu 18 May | Thu 13 Apr – Thu 18 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Friday | 6 | 6 | Fri 14 Apr – Fri 19 May | Fri 14 Apr – Fri 19 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Saturday | 6 | 6 | Sat 15 Apr – Sat 20 May | Sat 15 Apr – Sat 20 May |
| Summer ½1 2028 (Thu 13 Apr–Tue 23 May) | Sunday | 6 | 6 | Sun 16 Apr – Sun 21 May | Sun 16 Apr – Sun 21 May |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Monday | 7 | 7 | Mon 5 Jun – Mon 17 Jul | Mon 5 Jun – Mon 17 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Tuesday | 7 | 7 | Tue 6 Jun – Tue 18 Jul | Tue 6 Jun – Tue 18 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Wednesday | 7 | 6 **(-1)** | Wed 7 Jun – Wed 19 Jul | Wed 7 Jun – Wed 12 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Thursday | 7 | 7 | Thu 1 Jun – Thu 13 Jul | Thu 1 Jun – Thu 13 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Friday | 7 | 7 | Fri 2 Jun – Fri 14 Jul | Fri 2 Jun – Fri 14 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Saturday | 7 | 7 | Sat 3 Jun – Sat 15 Jul | Sat 3 Jun – Sat 15 Jul |
| Summer ½2 2028 (Thu 1 Jun–Tue 18 Jul) | Sunday | 7 | 7 | Sun 4 Jun – Sun 16 Jul | Sun 4 Jun – Sun 16 Jul |

## Table B: bank holidays falling on a lesson day inside a half-term (decision 3), 2026/27 to 2028/29

| Date | Holiday | Half-term | Lesson day affected |
|---|---|---|---|
| Fri 26 Mar 2027 | Good Friday | Spring ½2 2027 | Friday |
| Mon 3 May 2027 | Early May bank holiday | Summer ½1 2027 | Monday |
| Fri 14 Apr 2028 | Good Friday | Summer ½1 2028 | Friday |
| Mon 17 Apr 2028 | Easter Monday | Summer ½1 2028 | Monday |
| Mon 1 May 2028 | Early May bank holiday | Summer ½1 2028 | Monday |
| Mon 7 May 2029 | Early May bank holiday | Summer ½1 2029 | Monday |

Summary 2023/24–2032/33: of 420 weekday × half-term combinations, current billing is higher than the proposed count in 57, lower in 0, and equal in 363.
