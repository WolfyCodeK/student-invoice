# Bug audit — September 2026 (v1.0.1 → v1.1.0)

Status: **in progress** (static review of UI/store, billing and Rust done 2026-09-26; runtime pass pending). This file is the working record of the bug audit that
precedes the v1.1.0 release. Each finding has an id, severity, location (as of
v1.0.1 code), and a status. Findings that change money output are **never**
fixed directly: they go through a proposal in `docs/proposals/` that the owner
approves first (see [billing](../billing.md)).

Severity: **High** = wrong money/data loss/can't use a core feature;
**Medium** = feature misbehaves or misleads; **Low** = cosmetic or edge case.

## Findings

| Id | Sev | Area | Finding | Status |
|---|---|---|---|---|
| B1 | High | Billing | Lesson count is `ceil(term length / 7 days)` for every weekday, not the number of times the lesson weekday falls in the term. Some weekdays are over-billed and the quoted date range runs past the end of term (e.g. Thursday lessons in Autumn ½ 2023 end "26th October", term ends 25th). Evidence: `app/src/utils/__snapshots__/billing-v1.0.1.txt`. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B2 | High | Billing | Term end dates are midnight at the *start* of the last day, so from 00:00:01 on the last day of term the app reports "outside term" and generates no invoice. Evidence: `term-boundaries-v1.0.1.txt`. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B3 | High | Billing | Term dates are hard-coded and identical every year (1 Sep, 25 Oct, …), whereas real school terms move (Easter, weekdays). Example: summer ½ always starts 1 Jun but the May half-term week often includes 1–4 Jun (10 of 17 years 2024–2040, first 2027). The current term is only computed at app start, so it goes stale if the app stays open across a boundary (or through sleep). | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B4 | Medium | Invoice text | Custom body template uses `String.replace` with string replacements: `$&`, `$1`… in names are interpreted, and a name containing a later placeholder (e.g. `{{totalCost}}`) is substituted. | Open |
| B5 | Medium | Invoice | `findFirstLessonDate` loops forever if a template's `day` is not a weekday name (e.g. tampered or imported data). | Guarded (v1.1.0): templates without a valid weekday are never passed to the generator; imports reject them. Generator itself unchanged (billing rule). |
| B6 | Medium | UI | Invoice preview is not regenerated after editing the selected template or the email body template; a stale invoice is shown and copied. | Fixed (v1.1.0; runtime check pending) |
| B7 | Medium | UI | "Draft Email" is enabled outside term time and then fails with a misleading "check your Gmail connection" message. | Fixed (v1.1.0; runtime check pending) |
| B8 | Medium | Gmail | Connecting without credentials rethrows an unhandled rejection (no toast); `openUrl` is not awaited. | Fixed (v1.1.0; runtime check pending) |
| B9 | Low | Gmail | "Draft All" error labels extract the instrument instead of the recipient. | Fixed (v1.1.0; runtime check pending) |
| B10 | Medium | Gmail | UI shows "disconnected" once the access token expires even though a refresh token exists; refreshed tokens are never stored, so every draft refreshes again. | Fixed (v1.1.0; runtime check pending) |
| B11 | Medium | Gmail | OAuth loopback server keeps port 3001 bound until a login succeeds; retrying "Connect Gmail" fails with a bind error. | Fixed (v1.1.0; runtime check pending) |
| B12 | High | Updates | Update check builds JSON by hand with the release notes unescaped; a quote/backslash/newline in notes breaks update discovery. Cannot be fixed for installed v1.0.1 — mitigated by the `latest.json` notes rule (docs/compatibility.md). | Fixed in code for v1.1.0+ (typed result); v1.0.1 mitigated by the notes rule |
| B13 | Medium | Gmail | Draft MIME has no `Content-Type`/charset (the `£` and accented names can garble), Subject is not RFC 2047 encoded, CR/LF in the subject is not stripped, `To:` is empty, and `raw` uses standard instead of URL-safe base64. | Fixed (v1.1.0; runtime check pending) — MIME unit-tested |
| B14 | Low | Billing | Cost validation accepts `Infinity`/exponent strings; totals use floating-point multiplication. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B15 | Medium | Settings | Custom email body only persists if the outer Settings dialog's Save is also clicked; local edits reset if settings change while the dialog is open. | Open |
| B16 | High | Window | Window min and max height are both 940 px, so the app does not fit on 768/900 px-tall screens (common laptops, or 1080p at 125–150 % scaling). | Open |
| B17 | Low | Gmail | `lock().unwrap()` inside the spawned OAuth task panics if the mutex is poisoned. | Fixed (v1.1.0; runtime check pending) (code removed) |
| B18 | Low | Release | `Release.ps1` wrote `pub_date` as local time with a literal `Z`. | Fixed by new release tooling |
| B19 | Low | UI | `index.html` forces a dark background while the default theme is light; the 800 ms loading screen renders outside the theme provider and the `dark` class is applied only after first paint, so dark-mode users see dark → light → dark on every start. | Fixed (v1.1.0): loader removed; theme applied before first paint; verified in a release build |
| B20 | Medium | Settings | Several settings are stored but never used: `showNotifications`, `defaultTemplateId` ("auto-selected on startup" is not implemented), `emailMode`, `windowPosition`, `autoSave`. | Open |
| B21 | Medium | Gmail | "Disconnect" only clears UI state; the Rust-side token stays, so the next status check shows "connected" again. | Fixed (v1.1.0; runtime check pending) |
| B22 | Low | Gmail | Gmail connection is lost on every restart (tokens are memory-only), while the persisted `gmailConnected` flag briefly shows "connected" for ~1 s after start. | Fixed (v1.1.0; runtime check pending) |
| B23 | High | Billing | Bank holidays inside a term are billed as lessons: lessons are simply every 7 days. The Early May bank holiday falls in summer ½ every year (17/17 years 2023–2040); Good Friday or Easter Monday is billed in 10/17 years. Example: a Monday pupil at £20 in summer ½ 2025 is billed 6 lessons, including 21 Apr and 5 May. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B24 | Medium | Billing | The week count is computed from milliseconds (`ceil(ms / 7 days)`), which is sensitive to clock changes. Harmless with today's hard-coded dates (checked 2023–2040), but any fix for B3 that allows other dates must count calendar days (e.g. 1 Oct → 5 Nov gives 6, not 5). | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B25 | Medium | Invoice text | The default email is signed "the teacher", hard-coded. Anyone else using the app without a custom body sends invoices signed "the teacher". | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B26 | Medium | Billing/UI | Outside term time nothing can be invoiced, and the preview says "Select a template to preview the invoice" even when one is selected. There are gaps between every half-term, plus B2. | Empty-preview message fixed; invoicing between half-terms deferred to a future version (owner, 2026-09-26) |
| B27 | Low | Billing | A cost with more than 2 decimals (only reachable through stored or imported data) makes the calculation line inconsistent, e.g. 12.345 gives "8 x £12.35 = £98.76". Two-decimal costs are always correct (checked £0.01–£1000 × 1–10 lessons). | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B28 | Low | Settings | Saving the email-body editor unchanged stores a frozen copy of the default, so later changes to the default wording never reach that user. Misspelt placeholders (`{{ cost }}`) are sent verbatim with no warning. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B29 | Low | Invoice text | The same number is called "lessons" (UI), "sessions" (email), "8w"/"8 weeks" (UI, and `{{weeksCount}}` is described as "Number of weeks" although 1 Sep–25 Oct is 7 weeks 5 days). | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B30 | Low | Templates | Names are not trimmed and whitespace-only names are accepted ("Hi Alex ," / "Sam 's"); no length limit. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B31 | Low | Invoice text | The subject doesn't name the pupil (every piano family gets the identical subject, so Gmail drafts are hard to tell apart); instrument capitalisation "Bass guitar Lessons"; the date range has no year. | Deferred to a future version (owner, 2026-09-26: v1.1.0 keeps calculations, email wording and usage unchanged) |
| B32 | Low | Settings | The term-dates table highlights "Current" by half and season only, so a stale term (see B3) highlights the wrong year; from 19 Jul to 31 Aug it shows the finished year. | Open |
| B33 | High | Templates | The template form is never reset when reopened. "New" opens pre-filled with the previous template's values, and a cancelled edit comes back next time, so an unrelated later edit can silently save the cancelled values (e.g. a cost typed and then cancelled). | Fixed (v1.1.0; runtime check pending) |
| B34 | Low | UI | Toasts close after 5 s (Radix default), including error toasts, despite a code comment saying auto-dismiss was removed. | Open |
| B35 | Medium | UI | After deleting the selected template, the preview keeps showing the deleted template's invoice (`currentInvoice` is never cleared). | Fixed (v1.1.0; runtime check pending) |
| B36 | Medium | Gmail | Draft Email / Draft All have no in-progress guard or indicator; repeat clicks create duplicate Gmail drafts for every template. | Fixed (v1.1.0; runtime check pending) |
| B37 | Medium | Gmail | Draft failures are never shown in release builds: the toast says "check console" (release builds have no devtools), discards the real error, and says "Partial Success" when everything failed. | Fixed (v1.1.0; runtime check pending) |
| B38 | Low | UI | Draft All is enabled outside term time and fails with a misleading Gmail/templates message (Draft All counterpart of B7). | Fixed (v1.1.0; runtime check pending) |
| B39 | Low | Templates | Instrument/day select validation errors don't clear after choosing a value. | Open |
| B40 | Low | Accessibility | Labels not linked to their controls (instrument, day, default template, notifications switch, template picker, feedback), icon-only toast close button unnamed, Gmail status shown only by colour. | Open |
| B41 | Low | Feedback | Escape/overlay click discards typed feedback; closing and reopening during sending allows a duplicate send; the message is logged to the console. | Open |
| B42 | Medium | UI | The template picker shows "recipient - instrument Lessons", so two siblings with the same parent and instrument are indistinguishable, which makes invoicing the wrong one easy. | Open |
| B43 | Low | UI | Long unbroken names overflow their card; a long custom body grows the page instead of scrolling inside the preview (layout, unverified at runtime). | Open |
| B44 | Low | UI | Cosmetic: the Gmail sign-in steps render as one run-on paragraph; "up to date" shows both a dialog and a toast; `animate-*` classes do nothing (no animation plugin). | Open |
| B45 | Low | Templates | Scrolling the mouse wheel over the focused cost field may change the cost by £0.01 per notch (Chromium number-input behaviour; unverified). | Open |
| B46 | Medium | Data | Latent: persisted state uses zustand's shallow merge, so a new field added to `settings` with a default would be `undefined` for existing users. | Fixed (v1.1.0): custom merge; unit-tested |
| B47 | Medium | Robustness | No React error boundary: one malformed persisted value (e.g. a non-number `cost`) blanks the whole app on every launch. | Fixed (v1.1.0): error boundary with reload and backups folder |
| B48 | Medium | Gmail | Sign-in failures never reach the UI. Cancelling on Google's consent screen (`error=access_denied`) gets no HTTP response ("localhost didn't send any data"), and a failed code exchange is swallowed; in both cases the app spins "Waiting for authentication…" forever. | Fixed (v1.1.0; runtime check pending) |
| B49 | Medium | Gmail | Sign-in can break silently when another program listens on port 3001 over IPv6/dual-stack: the redirect uses `localhost`, which browsers may resolve to `::1`, while the app listens only on `127.0.0.1` (see S15). | Fixed (v1.1.0; runtime check pending) |
| B50 | Medium | Gmail | The code exchange uses a third, outdated TLS stack (oauth2 4.x → reqwest 0.11 → rustls with 2024 bundled roots) that ignores the Windows certificate store, so sign-in fails on PCs whose antivirus or proxy inspects HTTPS, even though drafts and updates work. | Fixed (v1.1.0; runtime check pending) |
| B51 | Medium | Gmail | Refresh failures are opaque: Google's error is discarded (`invalid_grant` looks like a network error), there is no expiry margin and no refresh-and-retry on a 401, and the UI never offers "Reconnect". | Fixed (v1.1.0; runtime check pending) |
| B52 | Low | Gmail | A log line slices the authorization code by bytes (`&code[..20]`), which panics on a multi-byte character and kills the pending sign-in (see S18). | Fixed (v1.1.0; runtime check pending) (code removed) |
| B53 | Low | Gmail | Granted scopes are never checked: a user who unticks the drafts permission on Google's screen is told "Gmail connected" and every draft then fails. | Fixed (v1.1.0; runtime check pending) |
| B54 | Low | Gmail | Loopback callback parsing is fragile: substring matching (`/auth/callbackX`, `xcode=`), `code` as the last parameter swallows " HTTP/1.1", a Chrome preconnect socket blocks the serial accept loop, and responses lack `Content-Length`/`Connection: close`. | Fixed (v1.1.0; runtime check pending) — parser unit-tested |
| B55 | Low | Updates | Updater has no timeout (a stalled check/download spins forever); `install_update` re-checks and could install a different version than shown; closing the dialog doesn't cancel it and the app exits when the download finishes (losing any unsaved form); dev builds check the real endpoint. | Mostly fixed: timeout, installs the update shown, progress, dialog can't close mid-install, off in dev builds. Unsaved edits are still lost when the installer closes the app. |

## Questions for the owner (business rules)

**Deferred (2026-09-26):** v1.1.0 does not change any calculation, email
wording or way of using the app. These questions will be settled with the
main user before a later version; see the
[billing proposal](../proposals/2026-09-billing-v1.1.md).

1. **Bank holidays (B23):** should bank holidays that fall on a lesson day be
   excluded from the lesson count, total and quoted dates? England & Wales
   holidays only?
2. **Term dates (B3):** should term dates be editable per academic year (for
   example from the school's published calendar), with today's dates as the
   defaults?
3. **Lesson count (B1/B2):** is the intended rule "the number of times the
   lesson weekday falls between the first and last day of the half-term,
   inclusive"?
4. **Between terms (B26):** should the next half-term's invoices be
   preparable during the holiday before it (e.g. late August for Autumn ½)?
5. **Sender name (B25):** is the app used only by the teacher, or should the
   sign-off be a setting (default "the teacher" so existing emails don't change)?
6. **Wording (B29/B31):** "lessons" or "sessions"? Should the subject name the
   pupil?

## Runtime verification (2026-09-26, dev build driven through the Tauri MCP server)

Confirmed in the running app:
- **B33:** a cancelled edit doesn't come back, and "New" opens empty.
- **B35:** deleting the selected template clears the preview.
- **B6:** the preview is generated as soon as a template is created.
- Names with `'`, `"`, `$&`, `£`-style characters and emoji are shown
  verbatim.
- **Invoice text:** identical to v1.0.1, including the deferred B1
  behaviour.
- **Backups:** the daily backup is created on start-up once there are
  templates. Restore shows a summary, saves a `pre-restore` backup first,
  then restores the data; the stored shape stays version 0 with the four
  v1.0.1 keys. A backup name like `..\..\Windows\win.ini` is rejected.
- **Updates:** the check is correctly disabled in development builds.
- **Gmail:** `gmail_status` reports the built-in client.

**Found and fixed during this pass:**
- A fresh install saved a pointless `pre-migration` backup of empty data;
  now only real data is backed up.
- Development builds shared the backups folder and Credential Manager
  entries with the installed app; they now use `backups-dev` and a `.dev`
  credential name.

Not yet exercised at runtime: Gmail sign-in and drafts (need the owner's
Google account), the native export/import dialogs, the feedback form, and
the updater (see the release test).

## Method

1. File-by-file review of `app/src` and `app/src-tauri/src`.
2. Runtime exploration of every flow with the Tauri MCP server.
3. Edge-case matrix: term boundaries, leap years, DST changes, names with
   `'` `"` `$&` `£` emoji and long text, 0 and 100+ templates, small screens
   and 125/150 % scaling.
