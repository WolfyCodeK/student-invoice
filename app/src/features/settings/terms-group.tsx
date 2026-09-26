// Settings → Term dates: this school year's six half-terms, read-only
// (utils/terms.ts; editing them is a later decision).
import { format } from "date-fns";
import { CalendarOff } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { academicYearStart, isSameTerm, nextTermAfter, schoolYearLabel, termRange } from "../../lib/term-display";
import { termsBySeason } from "./settings-logic";

export function TermsGroup() {
  const currentTerm = useAppStore((s) => s.currentTerm);
  const now = new Date();
  const start = academicYearStart(now);
  const year = schoolYearLabel(start);
  const seasons = termsBySeason(start);
  const next = currentTerm ? null : nextTermAfter(now);

  return (
    <>
      <p className="st-lead">
        The {year} school year. The app counts each family's lessons between these dates. They can't be changed here.
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
      <div className="st-terms" role="table" aria-label={`Half-term dates, ${year} school year`}>
        {seasons.map((s) =>
          s.halves.map((t, i) => {
            const isNow = isSameTerm(currentTerm?.term, t);
            return (
              <div key={`${s.season}-${t.half}`} className={`trow${i === 0 ? " is-split" : ""}${isNow ? " is-now" : ""}`} role="row">
                <span className="st-season" role="rowheader">
                  {i === 0 ? s.label : <span className="visually-hidden">{s.label}</span>}
                </span>
                <span className="st-half" role="cell">
                  {t.half} half
                  {isNow && <span className="tag">Now</span>}
                </span>
                <span className="st-dates num" role="cell">
                  {termRange(t.startDate, t.endDate)}
                </span>
              </div>
            );
          }),
        )}
      </div>
    </>
  );
}
