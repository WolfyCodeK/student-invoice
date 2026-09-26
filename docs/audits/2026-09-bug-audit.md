# Bug audit — September 2026 (v1.0.1 → v1.1.0)

Status: **in progress.** This file is the working record of the bug audit that
precedes the v1.1.0 release. Each finding has an id, severity, location (as of
v1.0.1 code), and a status. Findings that change money output are **never**
fixed directly: they go through a proposal in `docs/proposals/` that the owner
approves first (see [billing](../billing.md)).

Severity: **High** = wrong money/data loss/can't use a core feature;
**Medium** = feature misbehaves or misleads; **Low** = cosmetic or edge case.

## Findings

| Id | Sev | Area | Finding | Status |
|---|---|---|---|---|
| B1 | High | Billing | Lesson count is `ceil(term length / 7 days)` for every weekday, not the number of times the lesson weekday falls in the term. Some weekdays are over-billed and the quoted date range runs past the end of term (e.g. Thursday lessons in Autumn ½ 2023 end "26th October", term ends 25th). Evidence: `app/src/utils/__snapshots__/billing-v1.0.1.txt`. | Proposal needed |
| B2 | High | Billing | Term end dates are midnight at the *start* of the last day, so from 00:00:01 on the last day of term the app reports "outside term" and generates no invoice. Evidence: `term-boundaries-v1.0.1.txt`. | Proposal needed |
| B3 | High | Billing | Term dates are hard-coded and identical every year (1 Sep, 25 Oct, …), whereas real school terms move (Easter, weekdays). The current term is only computed at app start, so it goes stale if the app stays open across a boundary. | Proposal needed |
| B4 | Medium | Invoice text | Custom body template uses `String.replace` with string replacements: `$&`, `$1`… in names are interpreted, and a name containing a later placeholder (e.g. `{{totalCost}}`) is substituted. | Open |
| B5 | Medium | Invoice | `findFirstLessonDate` loops forever if a template's `day` is not a weekday name (e.g. tampered or imported data). | Open |
| B6 | Medium | UI | Invoice preview is not regenerated after editing the selected template or the email body template; a stale invoice is shown and copied. | Open |
| B7 | Medium | UI | "Draft Email" is enabled outside term time and then fails with a misleading "check your Gmail connection" message. | Open |
| B8 | Medium | Gmail | Connecting without credentials rethrows an unhandled rejection (no toast); `openUrl` is not awaited. | Open |
| B9 | Low | Gmail | "Draft All" error labels extract the instrument instead of the recipient. | Open |
| B10 | Medium | Gmail | UI shows "disconnected" once the access token expires even though a refresh token exists; refreshed tokens are never stored, so every draft refreshes again. | Open |
| B11 | Medium | Gmail | OAuth loopback server keeps port 3001 bound until a login succeeds; retrying "Connect Gmail" fails with a bind error. | Open |
| B12 | High | Updates | Update check builds JSON by hand with the release notes unescaped; a quote/backslash/newline in notes breaks update discovery. Cannot be fixed for installed v1.0.1 — mitigated by the `latest.json` notes rule (docs/compatibility.md). | Mitigated for releases; fix in code |
| B13 | Medium | Gmail | Draft MIME has no `Content-Type`/charset (the `£` and accented names can garble), Subject is not RFC 2047 encoded, CR/LF in the subject is not stripped, `To:` is empty, and `raw` uses standard instead of URL-safe base64. | Open |
| B14 | Low | Billing | Cost validation accepts `Infinity`/exponent strings; totals use floating-point multiplication. | Proposal needed |
| B15 | Medium | Settings | Custom email body only persists if the outer Settings dialog's Save is also clicked; local edits reset if settings change while the dialog is open. | Open |
| B16 | High | Window | Window min and max height are both 940 px, so the app does not fit on 768/900 px-tall screens (common laptops, or 1080p at 125–150 % scaling). | Open |
| B17 | Low | Gmail | `lock().unwrap()` inside the spawned OAuth task panics if the mutex is poisoned. | Open |
| B18 | Low | Release | `Release.ps1` wrote `pub_date` as local time with a literal `Z`. | Fixed by new release tooling |
| B19 | Low | UI | `index.html` forces a dark background while the default theme is light (flash on start); an artificial 800 ms loading screen delays startup. | Open |
| B20 | Medium | Settings | Several settings are stored but never used: `showNotifications`, `defaultTemplateId` ("auto-selected on startup" is not implemented), `emailMode`, `windowPosition`, `autoSave`. | Open |
| B21 | Medium | Gmail | "Disconnect" only clears UI state; the Rust-side token stays, so the next status check shows "connected" again. | Open |
| B22 | Low | Gmail | Gmail connection is lost on every restart (tokens are memory-only), while the persisted `gmailConnected` flag briefly shows "connected" for ~1 s after start. | Open |

## Method (to be completed)

1. File-by-file review of `app/src` and `app/src-tauri/src`.
2. Runtime exploration of every flow with the Tauri MCP server.
3. Edge-case matrix: term boundaries, leap years, DST changes, names with
   `'` `"` `$&` `£` emoji and long text, 0 and 100+ templates, small screens
   and 125/150 % scaling.
