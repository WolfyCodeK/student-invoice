// Parts shared by the register and an earlier half-term's page (docs/ui.md
// "Register"): the half-term buttons in the blue band, the Paid and Thank you
// sent ticks, a family's lesson marks, the half-term total row and the key.
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTermsForAcademicYear } from "../../utils/terms";
import { capitalise, moneyTotal } from "../../lib/format";
import { halfTermKey, type HalfTermTotals, type Tick } from "../../lib/half-terms";
import { schoolYearLabel, termRange } from "../../lib/term-display";
import type { TermDateOverrides } from "../../types";
import { markTitle, type RegisterLesson, type RegisterWeek } from "./weeks";

const SEASON_SHORT: Record<string, string> = { autumn: "Aut", spring: "Spr", summer: "Sum" };

interface NavProps {
  /** The school year shown. */
  year: number;
  minYear: number;
  maxYear: number;
  onYear: (year: number) => void;
  /** The half-term being invoiced (the register's own), if any. */
  currentKey: string | null;
  /** The half-term on screen. */
  openKey: string | null;
  /** Opens a half-term; null is the register's own. */
  onOpen: (key: string | null) => void;
  termDates?: TermDateOverrides;
  today: Date;
}

/**
 * One button per half-term of a school year, with arrows to change year.
 * Half-terms that have started open; later ones can't be opened yet.
 */
export function HalfTermNav({ year, minYear, maxYear, onYear, currentKey, openKey, onOpen, termDates, today }: NavProps) {
  const label = schoolYearLabel(year);
  return (
    <div className="terms" role="group" aria-label={`Half-terms in the ${label} school year`}>
      <button type="button" className="terms-arrow" onClick={() => onYear(year - 1)} disabled={year <= minYear} aria-label={`Show ${schoolYearLabel(year - 1)}`}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span className="terms-yr">{label}</span>
      <button type="button" className="terms-arrow" onClick={() => onYear(year + 1)} disabled={year >= maxYear} aria-label={`Show ${schoolYearLabel(year + 1)}`}>
        <ChevronRight aria-hidden="true" />
      </button>
      {getTermsForAcademicYear(year, termDates).map((t) => {
        const key = halfTermKey(t);
        const isNow = key === currentKey;
        const canOpen = isNow || t.startDate <= today;
        const name = `${t.half} half ${capitalise(t.season)} term`;
        return (
          <button
            key={key}
            type="button"
            className={`term${isNow ? " is-now" : ""}${key === openKey ? " is-open" : ""}`}
            aria-pressed={key === openKey}
            aria-current={isNow ? "true" : undefined}
            disabled={!canOpen}
            title={`${name}: ${termRange(t.startDate, t.endDate)}${isNow ? " (this half-term)" : canOpen ? "" : " (not started yet)"}`}
            onClick={() => onOpen(isNow ? null : key)}
          >
            {SEASON_SHORT[t.season]} {t.half === "1st" ? 1 : 2}
          </button>
        );
      })}
    </div>
  );
}

interface TickProps {
  tick: Tick;
  on: boolean;
  /** Who the tick is for, read out with it. */
  who: string;
  onChange?: (on: boolean) => void;
}

/** A Paid or Thanks sent tick box. */
export function TickCell({ tick, on, who, onChange }: TickProps) {
  const what = tick === "paid" ? "Paid" : "Thanks sent";
  return (
    <div className="c c-tick" role="cell">
      <input
        type="checkbox"
        className={`tick tick--${tick}`}
        checked={on}
        disabled={!onChange}
        aria-label={`${what}: ${who}`}
        title={what}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </div>
  );
}

interface MarksProps {
  weeks: RegisterWeek[];
  lessons: RegisterLesson[];
  /** Ticks or unticks a lesson; without it the marks can't be changed. */
  onToggle?: (lesson: RegisterLesson) => void;
  disabled?: boolean;
  /** Why the marks can't be changed right now. */
  lockedWhy?: string;
  /** The mark just changed (it animates). */
  changedKey?: string | null;
  tour?: string;
}

/** A family's weeks: one mark per lesson, in its week. */
export function LessonMarks({ weeks, lessons, onToggle, disabled, lockedWhy, changedKey, tour }: MarksProps) {
  const byWeek = new Map(lessons.map((l) => [l.week, l]));
  return (
    <div className="c weeks" role="cell" data-tour={tour}>
      {weeks.map((w, wi) => {
        const l = byWeek.get(wi);
        if (!l) return <span key={wi} className={`wk${w.afterTerm ? " is-holiday" : ""}`} />;
        const reason = l.ticked ? undefined : l.reason;
        if (!onToggle) {
          return (
            <span key={wi} className="wk">
              <span className={`mark is-static${l.ticked ? "" : " is-off"}`} data-reason={reason} role="img" aria-label={markTitle(l)} title={markTitle(l)} />
            </span>
          );
        }
        const label = format(l.date, "EEEE d MMMM");
        return (
          <span key={wi} className="wk">
            <button
              type="button"
              className={`mark${changedKey === l.key ? " is-changed" : ""}`}
              aria-pressed={l.ticked}
              data-reason={reason}
              disabled={disabled}
              title={`${markTitle(l)}${lockedWhy ? `. ${lockedWhy}` : ""}`}
              aria-label={
                l.ticked
                  ? `${label}: lesson. Untick if it didn't happen.`
                  : reason === "bank-holiday"
                    ? `${label}: bank holiday, not charged. Tick if the lesson went ahead.`
                    : `${label}: unticked, not charged. Tick to charge it again.`
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggle(l);
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

/** The register's ruled space below the families, down to the total row. */
export function FillRow({ weeks, results }: { weeks: RegisterWeek[]; results: boolean }) {
  return (
    <div className="row row--fill" aria-hidden="true">
      <div className="c" />
      <div className="c c-tick" />
      <div className="c c-tick" />
      <div className="c c-day" />
      <div className="c weeks">
        {weeks.map((w, wi) => (
          <span key={wi} className={`wk${w.afterTerm ? " is-holiday" : ""}`} />
        ))}
      </div>
      <div className="c tcell tb1" />
      <div className="c tcell c-per" />
      <div className="c tcell end" />
      {results && <div className="c status" />}
    </div>
  );
}

/** The half-term total, at the foot of the register. */
export function TotalRow({ totals, results }: { totals: HalfTermTotals; results: boolean }) {
  return (
    <div className="row row--total" role="row">
      <div className="c fam" role="rowheader">
        Half-term total
      </div>
      <div className="c c-sum" role="cell">
        <span>
          {totals.paidCount} of {totals.toPay} paid
        </span>
        <span>
          Paid <b>{moneyTotal(totals.paid)}</b>
        </span>
        <span className={totals.outstanding > 0 ? "is-due" : undefined}>
          Outstanding <b>{moneyTotal(totals.outstanding)}</b>
        </span>
      </div>
      <div className="c tcell tb1" role="cell" aria-label={`${totals.lessons} lessons`}>
        {totals.lessons}
      </div>
      <div className="c tcell c-per" role="cell" />
      <div className="c tcell end tot" role="cell">
        {moneyTotal(totals.total)}
      </div>
      {results && <div className="c status" role="cell" />}
    </div>
  );
}

/** The key under the register: only what's on it. */
export function Legend({ weeks, lessons }: { weeks: RegisterWeek[]; lessons: RegisterLesson[] }) {
  return (
    <p className="legend">
      <span>
        <i className="legend-mk" aria-hidden="true" /> Lesson
      </span>
      <span>
        <i className="legend-off" aria-hidden="true" /> Unticked (not charged)
      </span>
      {lessons.some((l) => !l.ticked && l.reason === "bank-holiday") && (
        <span>
          <i className="legend-off legend-bh" aria-hidden="true" /> Bank holiday (not charged)
        </span>
      )}
      {weeks.some((w) => w.afterTerm) && (
        <span>
          <i className="legend-hol" aria-hidden="true" /> After the half-term ends (a lesson there is still charged)
        </span>
      )}
    </p>
  );
}

/** The register's column headings, from Family to Total. */
export function HeadRow({ weeks, results }: { weeks: RegisterWeek[]; results: boolean }) {
  return (
    <div className="row row--head" role="row">
      <div className="c fam th" role="columnheader">
        Family
      </div>
      <div className="c th c-tick" role="columnheader">
        Paid
      </div>
      <div className="c th c-tick" role="columnheader" title="Thanks sent">
        Thanks
      </div>
      <div className="c th c-day" role="columnheader">
        Day
      </div>
      <div className="c weeks" role="columnheader" aria-label="Weeks">
        {weeks.map((w) => (
          <span
            key={w.monday.getTime()}
            className={`wk wk-h${w.afterTerm ? " is-holiday" : ""}`}
            title={w.afterTerm ? `Week of ${format(w.monday, "d MMMM")}: after the half-term ends. A lesson here is still charged.` : `Week of ${format(w.monday, "d MMMM")}`}
          >
            <b>{format(w.monday, "d")}</b>
            <span>{format(w.monday, "MMM")}</span>
          </span>
        ))}
      </div>
      <div className="c th tcell tb1" role="columnheader">
        Lessons
      </div>
      <div className="c th tcell c-per" role="columnheader">
        Per lesson
      </div>
      <div className="c th tcell end" role="columnheader">
        Total
      </div>
      {results && (
        <div className="c th status" role="columnheader">
          Gmail draft
        </div>
      )}
    </div>
  );
}
