// An earlier half-term, from its saved record (docs/ui.md "Earlier
// half-terms"; lib/half-terms.ts): what was charged, family by family and
// lesson by lesson, exactly as it was. Only Paid and Thanks sent can change.
import type { ReactNode } from "react";
import { parseISO } from "date-fns";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, History } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { getTermsForAcademicYear } from "../../utils/terms";
import { capitalise, instrumentLabel, money } from "../../lib/format";
import { halfTermTotals, type Tick } from "../../lib/half-terms";
import { termRange } from "../../lib/term-display";
import type { HalfTermFamily, HalfTermRecord } from "../../types";
import { recordLessons, recordWeeks, type RegisterWeek } from "./weeks";
import { FillRow, HeadRow, LessonMarks, Legend, TickCell, TotalRow } from "./register-parts";

interface Props {
  /** The record's key, e.g. "2025-5". */
  recordKey: string;
  /** The half-term buttons, as the register shows them. */
  nav: ReactNode;
  onBack: () => void;
  backLabel: string;
}

export function EarlierHalfTerm({ recordKey, nav, onBack, backLabel }: Props) {
  const { record, termDates, setHalfTermTick } = useAppStore(
    useShallow((s) => ({
      record: s.settings.halfTerms?.[recordKey],
      termDates: s.settings.termDates,
      setHalfTermTick: s.setHalfTermTick,
    })),
  );

  // The record's own dates; without one, the half-term's dates now.
  const [year, index] = recordKey.split("-").map(Number);
  const term = getTermsForAcademicYear(year, termDates)[index];
  const start = record ? parseISO(record.start) : term.startDate;
  const end = record ? parseISO(record.end) : term.endDate;
  const title = `${term.half} half ${capitalise(term.season)} term ${start.getFullYear()}`;
  const families = record ? [...record.families.filter((f) => !f.removedAt), ...record.families.filter((f) => f.removedAt)] : [];
  const weeks = record ? recordWeeks(record) : [];
  const totals = halfTermTotals(families);
  const onTick = (id: string, tick: Tick) => (on: boolean) => setHalfTermTick(recordKey, id, tick, on);

  return (
    <>
      <header className="band">
        <div>
          <h1>Register · {title}</h1>
          <div className="band-meta">
            <span>{termRange(start, end)}</span>
            {nav}
          </div>
        </div>
        <div className="band-side">
          <button type="button" className="bbtn" onClick={onBack}>
            <ArrowLeft /> {backLabel}
          </button>
        </div>
      </header>

      <div className="work work--full">
        <section className="regcol" aria-label={`Register, ${title}`}>
          {record && <RecordNote record={record} />}
          {families.length === 0 ? (
            <div className="past-empty">
              <History aria-hidden="true" />
              <p>Nothing was recorded for this half-term: there were no families on the register.</p>
            </div>
          ) : (
            <>
              <div className="sheet scroll" style={{ ["--weeks" as string]: Math.max(weeks.length, 1) }} role="table" aria-label={`Families and lessons, ${title}`}>
                <HeadRow weeks={weeks} results={false} />
                {families.map((f) => (
                  <PastRow key={f.id} family={f} record={record!} weeks={weeks} onTick={onTick} />
                ))}
                <FillRow weeks={weeks} results={false} />
                <TotalRow totals={totals} results={false} />
              </div>
              <div className="acts">
                <p className="acts-why acts-why--wide">A finished half-term: its lessons and totals stay as they were. Paid and Thanks can still be ticked.</p>
                <Legend weeks={weeks} lessons={families.flatMap((f) => recordLessons(f, record!))} />
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

/** How the record was made, when that matters for reading it. */
function RecordNote({ record }: { record: HalfTermRecord }) {
  const options = [
    record.charging?.insideHalfTermOnly && "only lessons inside the half-term were charged",
    record.charging?.skipBankHolidays && "lessons on bank holidays weren't charged",
  ].filter(Boolean);
  if (!record.workedOut && options.length === 0) return null;
  return (
    <div className={`past-note${record.workedOut ? " is-worked-out" : ""}`} role="note">
      <History aria-hidden="true" />
      <p>
        {record.workedOut && (
          <>
            <strong>Worked out, not saved at the time.</strong> This half-term was before version 1.1.2, or the app wasn't opened during it, so it
            was worked out later from the families and prices then. Check it against the invoices you sent.{" "}
          </>
        )}
        {options.length > 0 && <>In this half-term {options.join(", and ")}.</>}
      </p>
    </div>
  );
}

interface RowProps {
  family: HalfTermFamily;
  record: HalfTermRecord;
  weeks: RegisterWeek[];
  onTick: (id: string, tick: Tick) => (on: boolean) => void;
}

function PastRow({ family, record, weeks, onTick }: RowProps) {
  const lessons = recordLessons(family, record);
  return (
    <div role="row" className={`row${family.removedAt ? " is-removed" : ""}`}>
      <div className="c fam" role="cell">
        <span className="who">{family.recipient}</span>
        <span className="what">
          {family.students} · {instrumentLabel(family.instrument)}
          <span className="day-inline"> · {family.day.slice(0, 3)}</span>
          {family.removedAt && " · deleted during the half-term, not in the total"}
        </span>
      </div>
      <TickCell tick="paid" on={!!family.paid} who={family.recipient} onChange={onTick(family.id, "paid")} />
      <TickCell tick="thanked" on={!!family.thanked} who={family.recipient} onChange={onTick(family.id, "thanked")} />
      <div className="c c-day" role="cell">
        {family.day}
      </div>
      <LessonMarks weeks={weeks} lessons={lessons} />
      <div className="c tcell tb1" role="cell">
        {family.lessonCount}
        {family.lessonCount !== lessons.length && <span className="les-of">of {lessons.length}</span>}
      </div>
      <div className="c tcell c-per" role="cell">
        {money(family.cost)}
      </div>
      <div className="c tcell end tot" role="cell">
        {money(family.total)}
      </div>
    </div>
  );
}
