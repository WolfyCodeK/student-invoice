// Settings → Term dates: this school year's and next year's six half-terms,
// editable (docs/proposals/2026-09-editable-term-dates.md). The dates replace
// the usual ones wherever the app uses them; the calculation rules don't change.
import { useState } from "react";
import { format } from "date-fns";
import { CalendarOff, CircleCheck } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { useLeaveGuard } from "../app-context";
import { academicYearStart, isSameTerm, nextTermAfter, schoolYearLabel } from "../../lib/term-display";
import { getTermsForAcademicYear } from "../../utils/terms";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { halfTermName, sameTermDates, termDatesProblem, termDateTexts, withTermDates } from "./settings-logic";
import type { TermDates } from "../../types";

export function TermsGroup() {
  const currentTerm = useAppStore((s) => s.currentTerm);
  const termDates = useAppStore((s) => s.settings.termDates);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const now = new Date();
  const thisYear = academicYearStart(now, termDates);
  const next = currentTerm ? null : nextTermAfter(now, termDates);

  const [year, setYear] = useState(thisYear);
  const saved = termDateTexts(year, termDates);
  const edited = Boolean(termDates?.[String(year)]);
  const [draft, setDraft] = useState<TermDates[]>(saved);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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

  const resetToUsual = () => {
    updateSettings({ termDates: withTermDates(termDates, year, termDateTexts(year)) });
    setConfirmReset(false);
    setMessage("The usual dates are back for this school year.");
  };

  const years = [thisYear, thisYear + 1];
  return (
    <>
      <p className="st-lead">
        The app counts each family's lessons between these dates. If your school's dates are different, change them here: the register and
        the emails follow straight away.
      </p>
      {!currentTerm && (
        <p className="st-holiday">
          <CalendarOff aria-hidden="true" />
          <span>
            It's outside term time, so there are no invoices to make.
            {next && ` The next half-term starts on ${format(next.startDate, "EEEE d MMMM yyyy")}.`}
          </span>
        </p>
      )}
      <div className="sctl">
        <div className="seg" role="radiogroup" aria-label="School year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={year === y}
              disabled={changed && year !== y}
              data-tip={changed && year !== y ? "Save or undo your changes first" : undefined}
              onClick={() => {
                setYear(y);
                setMessage(null);
              }}
            >
              {schoolYearLabel(y)} {y === thisYear ? "(this year)" : "(next year)"}
            </button>
          ))}
        </div>
      </div>
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
        <p className="msg-bad" role="alert">
          {problem}
        </p>
      )}
      <div className="sctl">
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
        {edited && !changed && (
          <button type="button" className="btn btn--secondary" onClick={() => setConfirmReset(true)}>
            Reset to the usual dates
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

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogTitle>Use the usual dates?</DialogTitle>
          <DialogDescription>
            The {schoolYearLabel(year)} school year goes back to the usual half-term dates. The register and invoices change straight away.
          </DialogDescription>
          <DialogActions>
            <DialogClose asChild>
              <button type="button" className="btn btn--secondary">
                Keep my dates
              </button>
            </DialogClose>
            <button type="button" className="btn btn--primary" onClick={resetToUsual}>
              Use the usual dates
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
