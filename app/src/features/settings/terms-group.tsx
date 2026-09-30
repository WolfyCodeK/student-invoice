// Settings → Term dates: the current school year's six half-terms, editable
// (docs/proposals/2026-09-editable-term-dates.md). From 1 August it is the
// school year starting that autumn (docs/proposals/2026-09-v1.1.2-feedback.md,
// item 6). The dates replace the app's own wherever the app uses them; the
// calculation rules don't change. Dates saved for other years keep working.
import { useState } from "react";
import { format } from "date-fns";
import { CalendarOff, CircleCheck } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { useLeaveGuard } from "../app-context";
import { isSameTerm, nextTermAfter, schoolYearLabel, termDatesYear } from "../../lib/term-display";
import { getTermsForAcademicYear } from "../../utils/terms";
import { halfTermName, sameTermDates, termDatesProblem, termDateTexts, withTermDates } from "./settings-logic";
import type { TermDates } from "../../types";

export function TermsGroup() {
  const currentTerm = useAppStore((s) => s.currentTerm);
  const termDates = useAppStore((s) => s.settings.termDates);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const now = new Date();
  const year = termDatesYear(now);
  const inTerm = currentTerm !== null && currentTerm.term.startDate <= now;
  const next = inTerm ? null : nextTermAfter(now, termDates);

  const saved = termDateTexts(year, termDates);
  const [draft, setDraft] = useState<TermDates[]>(saved);
  const [message, setMessage] = useState<string | null>(null);

  // Start again from what's saved when the year or the saved dates change.
  const [basis, setBasis] = useState({ year, key: JSON.stringify(saved) });
  if (basis.year !== year || basis.key !== JSON.stringify(saved)) {
    setBasis({ year, key: JSON.stringify(saved) });
    setDraft(saved);
  }

  const changed = !sameTermDates(draft, saved);
  useLeaveGuard(changed);
  const problem = changed ? termDatesProblem(year, draft) : null;
  const terms = getTermsForAcademicYear(year, termDates);

  const setDay = (i: number, which: "start" | "end", value: string) => {
    setDraft((d) => d.map((t, k) => (k === i ? { ...t, [which]: value } : t)));
    setMessage(null);
  };

  const save = () => {
    updateSettings({ termDates: withTermDates(termDates, year, draft) });
    setMessage("Saved. The register and invoices now use these dates.");
  };

  return (
    <>
      <p className="st-lead">
        The half-terms of the <strong>{schoolYearLabel(year)}</strong> school year. They start as the app's best guess, so check them against
        your school's calendar and change any that are different: the register and the emails follow straight away. On 1 August this moves on
        to the next school year.
      </p>
      {!inTerm && (
        <p className="st-holiday">
          <CalendarOff aria-hidden="true" />
          <span>
            It's outside term time, so there are no invoices to make.
            {next && ` The next half-term starts on ${format(next.startDate, "EEEE d MMMM yyyy")}.`}
          </span>
        </p>
      )}
      <div className="st-terms" role="table" aria-label={`Half-term dates, ${schoolYearLabel(year)} school year`}>
        <div className="trow st-terms-head" role="row">
          <span role="columnheader">
            <span className="visually-hidden">Season</span>
          </span>
          <span role="columnheader">
            <span className="visually-hidden">Half</span>
          </span>
          <span className="st-dates" role="columnheader">
            First day
          </span>
          <span className="st-dates" role="columnheader">
            Last day
          </span>
        </div>
        {terms.map((t, i) => {
          const isNow = isSameTerm(currentTerm?.term, t);
          const name = halfTermName(i);
          return (
            <div key={`${t.season}-${t.half}`} className={`trow${i % 2 === 0 ? " is-split" : ""}${isNow ? " is-now" : ""}`} role="row">
              <span className="st-season" role="rowheader">
                {i % 2 === 0 ? name.split(",")[0] : <span className="visually-hidden">{name.split(",")[0]}</span>}
              </span>
              <span className="st-half" role="cell">
                {t.half} half
                {isNow && <span className="tag">Now</span>}
              </span>
              <span className="st-dates" role="cell">
                <input
                  type="date"
                  className="field st-date"
                  value={draft[i]?.start ?? ""}
                  onChange={(e) => setDay(i, "start", e.target.value)}
                  aria-label={`${name}: first day`}
                />
              </span>
              <span className="st-dates" role="cell">
                <input
                  type="date"
                  className="field st-date"
                  value={draft[i]?.end ?? ""}
                  onChange={(e) => setDay(i, "end", e.target.value)}
                  aria-label={`${name}: last day`}
                />
              </span>
            </div>
          );
        })}
      </div>
      {problem && (
        <p className="msg-bad st-terms-after" role="alert">
          {problem}
        </p>
      )}
      <div className="sctl st-terms-after">
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={!changed || problem !== null}
          data-tip={!changed ? "Nothing to save: the dates haven't changed" : problem ? "Fix the dates first" : undefined}
          data-tip-side="left"
        >
          Save dates
        </button>
        {changed && (
          <button type="button" className="btn btn--secondary" onClick={() => setDraft(saved)}>
            Undo changes
          </button>
        )}
        <p className="st-save-state" role="status">
          {changed ? (
            <span className="st-unsaved">Not saved yet</span>
          ) : (
            message && (
              <span className="ok">
                <CircleCheck aria-hidden="true" />
                {message}
              </span>
            )
          )}
        </p>
      </div>
    </>
  );
}
