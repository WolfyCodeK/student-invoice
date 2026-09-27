---
name: Student Invoice
description: The half-term laid out as a class register; the totals at the end of each row are the invoice.
colors:
  cover: "#1d3f8a"
  cover-ink: "#ffffff"
  cover-muted: "#c9d6f2"
  cover-ok: "#8be0ae"
  primary: "#1d3f8a"
  primary-ink: "#ffffff"
  primary-hover: "#17336f"
  head-ink: "#1d3f8a"
  band-btn: "#ffffff"
  band-btn-hover: "#e6eefa"
  margin: "#d0453a"
  page: "#ffffff"
  ground: "#f2f5fa"
  rule: "#c8d6ea"
  rule-strong: "#9db2d6"
  ink: "#172033"
  heading: "#111a2c"
  muted: "#53607a"
  mark-soft: "#7d93c4"
  mark-off: "#9aa6bd"
  selected: "#e6eefa"
  sel-line: "#9db5e3"
  row-hover: "#f5f8fd"
  totals: "#f6f8fc"
  totals-sel: "#d8e4f7"
  sec-hover: "#eef3fb"
  field-line: "#8fa5cc"
  holiday: "#f4f1ea"
  holiday-hatch: "#d9ceb8"
  holiday-ink: "#6f6450"
  success: "#1f7a47"
  warning: "#8a5a00"
  warning-bg: "#fdf3e1"
  danger: "#b42318"
  danger-bg: "#fceeec"
  danger-line: "#e3a199"
  na-cover: "#2e4c6d"
  na-amber: "#c98a34"
  na-ground: "#eff3f7"
  dark-page: "#10151f"
  dark-ground: "#0b0f17"
  dark-cover: "#23407f"
  dark-mark: "#9db7f0"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "-0.005em"
  figure:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "30px"
    fontFeature: "\"tnum\""
  total:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
    fontFeature: "\"tnum\""
  body-large:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  button:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
  button-large:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
  headline-navy-amber:
    fontFamily: "Nunito, Nunito Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: "30px"
    letterSpacing: "-0.01em"
  body-navy-amber:
    fontFamily: "Nunito Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  btn: "4px"
  field: "4px"
  panel: "4px"
  letter: "4px"
  block: "2px"
  chip: "3px"
  btn-rounded: "999px"
  field-rounded: "8px"
  panel-rounded: "14px"
  letter-rounded: "22px"
  block-rounded: "6px"
  chip-rounded: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  inset: "20px"
  xl: "24px"
  section: "44px"
  row: "58px"
  week: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.head-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.sec-hover}"
  button-danger:
    backgroundColor: "{colors.page}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    height: "36px"
    padding: "0 14px"
  button-danger-hover:
    backgroundColor: "{colors.danger-bg}"
  band-button:
    backgroundColor: "{colors.band-btn}"
    textColor: "{colors.cover}"
    typography: "{typography.button-large}"
    rounded: "{rounded.btn}"
    height: "40px"
    padding: "0 18px"
  band-button-hover:
    backgroundColor: "{colors.band-btn-hover}"
  band-button-ghost:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.button-large}"
    rounded: "{rounded.btn}"
    height: "40px"
    padding: "0 18px"
  field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.field}"
    height: "38px"
    padding: "0 12px"
  segmented-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    height: "32px"
    padding: "0 14px"
  term-block:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-muted}"
    rounded: "{rounded.block}"
    height: "26px"
    padding: "0 8px"
  term-block-now:
    backgroundColor: "{colors.band-btn}"
    textColor: "{colors.cover}"
  tag:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.chip}"
    height: "24px"
    padding: "0 10px"
  register-row:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    height: "58px"
  register-row-hover:
    backgroundColor: "{colors.row-hover}"
  register-row-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.heading}"
  totals-cell:
    backgroundColor: "{colors.totals}"
    textColor: "{colors.ink}"
    typography: "{typography.total}"
  totals-cell-selected:
    backgroundColor: "{colors.totals-sel}"
  pupil-page-head:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "14px 20px"
  record-panel:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.panel}"
    padding: "12px 24px"
  dialog:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.letter}"
    padding: "24px 28px"
    width: "560px"
  tour-card:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.panel}"
    padding: "18px 20px 16px"
    width: "340px"
  nav-item-current:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.heading}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    height: "40px"
    padding: "0 12px"
---

# Design System: Student Invoice

## Overview

**Creative North Star: "The Class Register"**

Student Invoice is a UK school register in software form. The half-term is the page. Every family is a ruled row, every lesson is a dated diagonal mark, and the tinted block at the end of the row is the invoice. A register-blue cover band runs across the title bar and header as one piece. Below it sits a white, feint-ruled page with a double margin rule between the names and the lessons. The pupil's page sits to the right as a side panel, like a slip laid on the register. The app avoids the usual invoice list with status pills. Any state it shows belongs to the register itself: a mark, a tint, or a word in the row.

The density is that of a working document, not a dashboard. Rows are a generous 58px and the lettering is Atkinson Hyperlegible Next, chosen for reading figures at a glance. Tabular figures appear wherever money or dates line up. The system has three independent appearance switches on the root element: colour scheme (Student Invoice or Navy and amber), corners (Square or Rounded) and mode (Light or Dark, Light by default). The frontmatter records the default combination: Student Invoice, square, light. The other combinations swap token values and never change the structure. The Navy and amber scheme pairs slate navy and amber with the softer Nunito lettering.

The teacher has basic computer confidence and uses the app by day and at night. That is why every scheme and mode keeps readable contrast, every control works from the keyboard, and all motion stops under reduced-motion.

**Key Characteristics:**
- A single cover band in the scheme's cover colour, joined to the Discord-style title bar with Windows 11 caption buttons.
- A white ruled page. Blank rows keep their ruling below the last family, so the page never ends in empty space.
- A double margin rule that marks where the lessons begin.
- Lesson marks drawn as masked SVG strokes: a diagonal stroke for a lesson and a dashed circle for an unticked one.
- A tinted totals block at the end of every row, where money is always tabular.
- A pupil's page side panel with a slight shadow to its left.
- Three appearance switches that change only token values, never structure.

## Colors

The page is white, cool-ruled and near-neutral, under one saturated register-blue band. There is one warm accent, the margin rule. The Navy and amber scheme swaps the blue for slate navy and the red margin for amber.

### Primary
- **Register Blue** (cover / primary / head-ink, #1d3f8a): the cover band across the title bar and header, the primary button, the selected segment and the "Now" tag. As head-ink it colours column headings, icons and links. In light mode it also draws the lit lesson marks and the money in the pupil's page sum. In dark mode the cover stays deep (dark-cover), while head-ink and the lit marks lift to Pale Register Blue (dark-mark) so they stay legible on the dark page.
- **Pressed Register Blue** (primary-hover, #17336f): hover on primary buttons only.

### Secondary
- **Margin Red** (margin, #d0453a): only the 4px double margin rule. It appears between the family columns and the week columns of the register, down the first-run step list, and at the left of the family editor's lesson strip. In the Navy and amber scheme the margin is Amber (na-amber).
- **Navy** (na-cover, #2e4c6d) and **Amber** (na-amber, #c98a34): the Navy and amber scheme's cover and accent. Amber fills the band buttons, the current term block and the margin rule. On the Navy and amber dark page, money in the pupil's page sum uses amber (#d59a45).

### Tertiary
- **Holiday Hatch** (holiday #f4f1ea, holiday-hatch #d9ceb8, holiday-ink #6f6450): weeks after the half-term ends. A warm paper tint carries a -45deg hatch of 1.5px lines every 7px. The week's date heading turns holiday-ink.

### Neutral
- **Page White** (page, #ffffff): the register page, pupil's page, dialogs, record panels and the tour card.
- **Ground** (ground, #f2f5fa): the window behind pages, such as the family editor background and the Settings navigation rail.
- **Feint Rule** (rule, #c8d6ea): row rules, week column rules and dividers inside panels.
- **Strong Rule** (rule-strong, #9db2d6): the register's heading rule, panel borders, the totals block's left edge, and secondary button outlines.
- **Register Ink** (ink, #172033), **Heading Ink** (heading, #111a2c), **Muted** (muted, #53607a): body text, the selected row's family name and headings, then secondary lines such as pupils, instruments, hints and the legend.
- **Soft and Off Marks** (mark-soft #7d93c4, mark-off #9aa6bd): marks at rest, and the dashed "untick" circle.
- **Selection Wash** (selected #e6eefa, sel-line #9db5e3, totals-sel #d8e4f7): the selected row, the pupil's page header, the current Settings item and chosen appearance tiles. A 1px inset sel-line outlines them.
- **Totals Tint** (totals, #f6f8fc): the block at the end of each row.
- **Status** (success #1f7a47, warning #8a5a00, danger #b42318; warning and danger each with a pale background): Gmail and draft outcomes, holiday notes, unsaved wording, destructive actions, and failed Draft all rows.

### Named Rules
**The One Band Rule.** The cover colour fills only the title bar and the header band beneath it. Everything below the band is page, ground or wash; there is no second saturated field.

**The Margin Is Not Danger Rule.** Margin Red belongs to the ruling of the register. Errors and deletion use danger (#b42318), which is a different red with its own pale backgrounds. Never swap one for the other.

**The Scheme Swaps Values Rule.** Components read only tokens. A new surface must look right under all four scheme-and-mode combinations and both corner settings without extra rules. Only the scheme preview swatches and the Windows close-button red (#c42b1c) use literal colours.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with Segoe UI, system-ui)
**Body Font:** Atkinson Hyperlegible Next (with Segoe UI, system-ui)
**Navy and amber scheme:** Nunito for headings (weight 800, -0.01em) and Nunito Sans for everything else

**Character:** In the Student Invoice scheme one hyperlegible family carries everything. It was chosen for telling similar figures and letters apart, and it works in the register's figures, dates and money. The Navy and amber scheme uses the softer, rounder Nunito pair. The fonts are bundled variable woff2 files (Latin and Latin Extended), so no system display face ever stands in.

### Hierarchy
- **Headline** (700, 22px, 30px): the band heading, such as "Register · 1st half Autumn term 2026" or "Editing Sarah's details", and dialog titles.
- **Figure** (600, 22px, 30px, tabular): the pupil's page sum, "7 lessons × £25.00 = £175.00". The total inside it is 700 in the money colour. It steps down to 18px/24px below 1100px, or 20px in the editor's preview panel.
- **Title** (700, 17px, 24px): the pupil's page name, Settings group headings, record panel headings and tour step headings.
- **Body Large** (400 to 600, 15px): family names in the register (600), field text, field labels (600), dialog text and tour text.
- **Body** (400, 14px, 1.45): the default for the email preview, row text and Settings prose.
- **Label** (600, 13px, 1.2, +0.02em, sentence case): register column headings in head-ink. Week headings stack a 14px/700 date over a 13px/600 month.
- **Caption** (400, 13px, 1.35): pupils and instruments under a family name, hints, the legend, and the band's Gmail status.

### Named Rules
**The Tabular Money Rule.** Every figure that lines up with another uses tabular numerals: totals, per-lesson costs, lesson counts, week dates, the term strip and the sum.

**The Lettering Follows the Scheme Rule.** Fonts come from `--font-ui` and `--font-head` and nothing else. A surface never names a family directly.

## Layout

The window is a vertical stack: a 40px title bar, the header band, then the workspace. The band is a two-column grid. The heading and meta line (dates, then the six-block term strip) sit on the left. The Gmail status and band buttons sit on the right, wrapping within 560px. Padding is 8px 24px 18px 20px.

The register workspace is a two-column grid. The register takes the remaining width, and the pupil's page takes `clamp(340px, 30vw, 440px)` on the right. (The direction contract planned a 64/36 split; the built panel is clamped instead.) The register grid runs Family (min 150px, flexible) | Day (96px) | margin | one 40px column per week | Lessons (70px) | Per lesson (88px) | Total (104px). During Draft all a 260px status column is added. Rows are 58px, and the header row is a sticky 46px. The action bar under the register is at least 56px, with actions on the left and the mark legend pushed to the right.

The register responds to its own width through a container query. At 880px or less, Day and Per lesson collapse to zero-width tracks, which stay in the grid so later cells do not shift. The day folds into the family line and weeks narrow to 36px. At 640px or less, weeks are 32px and the family column's minimum drops to 130px. On the pupil's page, below 1100px wide its buttons stack full width, and below 720px tall it scrolls as one piece with its button bar pinned.

Settings and the family editor use a 248px navigation rail (200px below 1020px, and a 64px icon-only rail below 860px) beside a page with 28px 44px 64px padding. Settings groups are 880px maximum and 44px apart. Setting rows are a 220px label column plus controls, with a 16px vertical rhythm and feint rules between them. The family editor centres a 664px record, with a 360px preview beside it that hides below 1100px.

Spacing rhythm: 4, 8, 12 and 16px inside components; a 20px page inset (the register's left edge and the pupil's page); 24px for panel padding and larger gaps; 44px between Settings groups.

## Elevation & Depth

The system is a flat ruled page with a small shadow vocabulary for things that sit on top of it. Surfaces separate by hairline rules, the ground/page contrast and tinted washes, not shadow. Shadow appears only on a raised control, a panel lifted off the ground, the pupil's page lying over the register, and overlays. Every shadow is a soft, blurred, low-alpha tint of the scheme's ink; in dark mode it becomes a stronger black. A selected row or current navigation item gets a 1px inset outline in sel-line, not a lift.

### Shadow Vocabulary
- **Raise** (`box-shadow: 0 1px 2px rgba(16, 32, 72, 0.1)`): primary buttons, band buttons and the editor's small preview panel.
- **Lift** (`box-shadow: 0 4px 14px rgba(16, 32, 72, 0.08)`): the family editor's record panel on the ground, and tooltips.
- **Overlay** (`box-shadow: 0 22px 52px rgba(16, 32, 72, 0.3)`): dialogs, the What's new letter, toasts, select menus, the tour card and the Choose how it looks panel.
- **Slip** (`box-shadow: -6px 0 16px rgba(16, 32, 72, 0.06)`): the pupil's page, which casts a shadow onto the register to its left.
- **Tour spotlight** (`box-shadow: 0 0 0 3px var(--focus-on-cover), 0 0 0 200vmax var(--tour-scrim)`): a white ring around the highlighted area, with the rest of the window dimmed.

### Named Rules
**The Ruled Page Rule.** Anything that is part of the register (rows, totals, week columns, Settings rows) is flat and divided by rules. Shadow means "lying on top of the page", nothing else.

## Shapes

Corners come from six radius tokens, and the corners switch sets them all together. Square (the default) is quietly squared: 4px buttons, fields, panels and dialogs; 2px term blocks and swatches; 3px chips. Rounded is the softer shape, available with either scheme: pill buttons, segmented controls and chips (999px), 8px fields and menu items, 14px panels, toasts and the tour card, 22px dialogs, and 6px term blocks. Switches, the progress bar, scrollbar thumbs and dots are always fully round, whichever setting is on.

Borders are 1px throughout. The exceptions are the 4px double margin rule, the 1.5px outlines of switches and first-run step numbers, and the 3px focus outline (offset 2px, or 1px on fields). The Holiday Hatch is the only pattern fill, and the lesson marks are the only drawn shapes.

**The One Switch Rule.** Radius is always one of the six tokens. A component never sets its own corner value, so Square and Rounded stay complete for every new surface.

## Components

### Buttons
Plain and confident: 600 weight, an icon on the left, never uppercase.
- **Shape:** the button radius (4px square, pill when rounded). Heights are 36px by default, 40px large, 32px small.
- **Primary:** a Register Blue fill with white text, a 1px border in primary-line and the Raise shadow. It is used for the one committing action in a place, such as Save changes or Save as Gmail draft.
- **Secondary:** a page-white fill with a Strong Rule outline and head-ink text, for Copy subject, Add a family, Edit and Cancel.
- **Ghost and link:** a transparent ghost with a head-ink icon, and an underlined head-ink link offset 3px (Skip tour).
- **Danger:** a page-white fill with a danger-line outline and danger text; a solid danger version appears inside confirmation dialogs.
- **Hover / Focus / Disabled:** background colour changes over 0.12s. Focus is a 3px outline in the focus colour. Disabled buttons drop to 50% opacity and lose their shadow.
- **Band buttons:** 40px buttons on the cover band. In Student Invoice they are white with blue text; in Navy and amber they are amber with dark brown text. They are 700 weight with 18px icons. The ghost version is transparent with a translucent white outline. When disabled, they turn to a translucent white fill (cover-off) rather than fading.

### Chips
- **Term strip:** six 26px blocks (Aut 1 to Sum 2) on the band, outlined in translucent white with muted cover text. The current half-term is filled with the band button colour.
- **Tag:** a 24px Register Blue chip with white 13px text, used for "Now" in the term dates table.
- **Placeholder code:** 700-weight head-ink text on the selection wash, used for placeholders in the email wording editor.

### Cards / Containers
- **Corner Style:** the panel radius (4px square, 14px rounded). Dialogs use the letter radius (4px square, 22px rounded).
- **Background:** Page White on Ground.
- **Shadow Strategy:** Lift for the editor record, and Overlay for dialogs, toasts and the tour card (see Elevation & Depth).
- **Border:** a 1px Strong Rule. Danger zones use a danger-line border with no shadow.
- **Internal Padding:** 12px 24px for record rows, 24px 28px for dialogs, and 26px 34px 24px for the What's new letter.

### Inputs / Fields
- **Style:** 38px high, a 1px field-line border, a page-white fill (a deeper fill in dark mode) and 15px text. Placeholders are muted at full opacity. Money fields carry a muted "£" inside and tabular figures.
- **Focus:** a 3px focus outline offset 1px, and the border shifts to accent-line.
- **Error:** a danger border and a 13px danger message 6px below.
- **Select:** the same shell as a field with a muted chevron. Its menu is a page-white panel with the Overlay shadow and the selection wash on the highlighted item.
- **Switch and segmented control:** the switch is a 42×24px pill that fills with primary when on. The segmented control is a 3px-padded field-line tray whose chosen segment is filled with primary.

### Navigation
- **Title bar:** 40px high on the cover colour. The app name and icon sit on the left, the current place with an 18px muted icon in the centre, and icon buttons (the tour, updates, feedback, Settings) on the right. Each has a data-tip tooltip. When an update is waiting, the updates button becomes an "Update ready" pill in the band button colours. Windows 11 caption buttons are 46px wide, and close turns Windows red (#c42b1c) on hover.
- **Settings rail:** on the Ground colour with 40px items, 18px head-ink icons and 600-weight labels. The current item takes the selection wash with a 1px inset sel-line outline. Below 860px it becomes a 64px icon-only rail with side tooltips.

### The Register Row (signature)
A 58px row with the family name (15px/600) over its pupils and instrument (13px muted), then the day. The 4px double margin rule comes next, then one cell per week. Each cell holds a mark button of at least 44px. At rest the diagonal stroke is mark-soft. **Selecting a row lights its marks**: ticked marks take the full mark colour, the row is washed in selected with a 1px inset sel-line, and its totals block deepens to totals-sel. Clicking a mark unticks the lesson: it becomes a dashed off-mark circle, with a 0.22s scale-in (0.6 to 1). Unticked marks stay off marks in a selected row too, mixed 15% towards the mark colour only to keep their contrast on the wash. Holiday weeks carry the Holiday Hatch. The totals block ends the row: the lesson count ("7 of 8" with a muted "of 8"), the per-lesson cost, and the total at 700 weight, all right-aligned and tabular. Blank ruled rows continue down to the bottom of the page.

### Draft All status
During Draft all a status column opens at the end of each row. Each row's outcome fades in over 0.26s as its draft finishes. A success tick marks a saved row and dims its name and total to muted. A failed row is washed in danger-bg, its totals turn danger-bg2, and it carries a danger icon with a short reason. (The contract planned a choreographed sweep. The build shows each row's status as its draft completes, with no stagger added.)

### The Pupil's Page
The side panel beside the register. Its head sits on the selection wash: the Title name, a muted caption line, the Figure sum and a muted note of any unticked lessons. Below come the subject line with Copy subject, the email preview in pre-wrapped body text, and a bottom bar with Copy email text and Save as Gmail draft. A one-line muted reason appears under the buttons when drafting is unavailable.

### What's new and the tour
What's new is a letter: a dialog with a letterhead (the app icon, "Student Invoice" in head-ink, and a muted version line), the headline, then 3–5 lines. Each line has an 18px head-ink icon, and feint rules separate the lines. The tour is a 340px card beside a spotlight ring. It has a 13px/700 head-ink step count ("2 of 7"), 7px progress dots, a Title heading, 15px text, and Skip tour as a link on the left of the button bar.

After the v1.1.0 update, **Choose how it looks** comes between the letter and the tour. It is a small panel docked 12px from the bottom-right corner, over the pupil's page and never over the title bar, up to 380px wide and always inside the pupil's page with a 12px margin. It is Page White with a 1px Strong Rule border, the panel radius and the Overlay shadow, and it rises 8px as it fades in. Its overlay stops stray clicks but is clear, not dimmed, so the register shows each choice as it is made. Inside are a Title heading, a 14px line of text, then Colours, Corners and Light or dark, each under a feint rule with a 14px/600 label. The Colours and Corners tiles are the Settings tiles in a two-column grid, with the picture above the words and the tick in the top corner; in windows under 720px tall their notes are hidden. Show me around sits at the bottom right. Like every surface, it uses tokens only.

## Do's and Don'ts

### Do:
- **Do** read every colour, font and radius from the tokens so all four scheme-and-mode combinations and both corner settings stay complete.
- **Do** put state in the register: lit marks for the selected row, dashed circles for unticked lessons, hatch for weeks after the half-term, muted text for drafted rows and a danger wash for failed ones.
- **Do** use tabular numerals for every aligned figure, money and date.
- **Do** keep the 4px double margin rule where names end and lessons begin (register rows, the editor's lesson strip, the first-run steps), in the scheme's margin colour.
- **Do** keep rows ruled to the bottom of the page, and keep controls at 36px (buttons), 38px (fields) and 40px (band and navigation), with marks no smaller than 44px.
- **Do** write labels in sentence case, and give icon-only buttons a data-tip tooltip and an accessible name.

### Don't:
- **Don't** show invoice state as coloured status pills in a list; the register row and its status column carry it.
- **Don't** use Margin Red for errors or Danger red for ruling.
- **Don't** fill any second area with the cover colour, or put page content on the band beyond the heading, meta line, term strip, Gmail status and band buttons.
- **Don't** give register rows, totals or Settings rows a shadow; use rules and washes.
- **Don't** hard-code a radius, colour or font family in a component. The scheme swatches and the Windows close-button red are the only literal colours.
- **Don't** use uppercase labels, eyebrows or small headings stacked above titles; column headings are 13px/600 sentence case in head-ink.
