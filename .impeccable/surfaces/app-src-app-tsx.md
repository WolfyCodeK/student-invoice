---
version: 1
slug: "app-src-app-tsx"
primary_target: "app/src/App.tsx"
related_targets: []
---

# Main app surface

**Scope:** the whole desktop app. That means the main register screen, the Draft All results, editing a family, Settings, first run, What's new, and the compact window.
**Mode:** Operate.

**Audience and job:** This is the teacher, a private music teacher with basic computer confidence. At each half-term he checks every family's invoice, then saves them all as Gmail drafts, which he reviews and sends from Gmail.
**Constraints:**
- Every existing function stays.
- Money and email wording change only through an approved proposal. The lesson unticking in `docs/proposals/2026-09-untick-lessons.md` is awaiting approval.
- The compatibility invariants hold.
- The app stays within the performance budgets.
- The title bar is Discord-style, with Windows 11 caption buttons.

**Chosen direction:** Register, picked by the owner on 2026-09-26. the teacher liked the idea of unticking a lesson that didn't happen.
**Appearance:** three independent switches in Settings:
- colour scheme: Student Invoice (register blue) or Navy and amber (navy and amber, with Nunito lettering);
- corners: Square or Rounded, where Rounded gives pill buttons and 8/14/22 px radii;
- mode: Light or Dark, with Light the default.

**App icon:** "Invoices and tick", to be redrawn as a vector master.

**Memorable moment:** the register grid itself, where every lesson is a dated mark and the totals sit at the row's end.

**Reference mock:** the Register fragment published on the design review artifact, https://claude.ai/artifact/5FCMHUDncH5tpiXjGxcL5y. It is the critique reference for the finish review. It is code-led, so there is no approved comp.

**Unresolved:**
- the untick-lessons proposal: the rule, which version, and how a single lesson's date range reads;
- billing decisions 1, 3, 4 and 6 are still pending with the teacher.

## Direction contract

**THESIS.** The half-term laid out as a register. Every family is a row and every lesson a dated mark. The totals at the end of the row are the invoice. It refuses the category default of an invoice list with status pills.

**OWN-WORLD.** A UK class register in school-software form:
- a register-blue `#1D3F8A` cover band across the title bar and header;
- a white page with feint `#C8D6EA` ruled rows;
- a red double margin rule `#D0453A`, used only between family and lessons;
- diagonal-stroke register marks;
- a tinted totals block at the end of each row;
- a pupil's-page side panel;
- Atkinson Hyperlegible Next with tabular figures.

**STORY.** At half-term the teacher opens the register. Every family and every lesson is already marked. He unticks any lesson that didn't happen (once approved), checks each total, presses Draft all, and finishes in Gmail.

**FIRST VIEWPORT.** At 1280×720:
- a blue title bar;
- a blue band with "Register · 1st half Autumn term 2026", the dates, a six-block term strip, the Gmail status and **Draft all 6 in Gmail** at top right;
- on the left 64%, the grid: Family | Day | margin | 8 dated marks | Lessons | Per lesson | Total;
- on the right 36%, the pupil's page: "8 lessons × £25.00 = £200.00", the subject and email, and Copy / Save as Gmail draft.

**FORM.** Register, #1 on the ordered list (Impeccable's pick). Seed 34af3b1f. Signature: selecting a row lights its marks; Draft all sweeps a status tick down the rows.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
