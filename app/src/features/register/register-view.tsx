// The main screen: the register for the current half-term (docs/ui.md
// "Register"). One row per family, one column per week, one mark per lesson;
// clicking a mark unticks a lesson that didn't happen (docs/billing.md).
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarOff, CircleCheck, Loader2, Mail, MailCheck, MailPlus, Mails, MailX, Pencil, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { useAppStore, type DraftOutcome } from "../../stores/app-store";
import { getTermsForAcademicYear } from "../../utils/terms";
import { generateInvoice } from "../../utils/invoice-generator";
import { errorMessage, isBackendError } from "../../lib/backend";
import { useToast } from "../../hooks/use-toast";
import { useAppActions } from "../app-context";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { registerLessons, registerWeeks } from "./weeks";
import { PupilPage } from "./pupil-page";
import type { InvoiceTemplate } from "../../types";

const money = (n: number) => `£${n.toFixed(2)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The six half-terms of the academic year that contains `date`. */
function academicYear(date: Date) {
  const start = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return { start, terms: getTermsForAcademicYear(start) };
}

const SEASON_SHORT: Record<string, string> = { autumn: "Aut", spring: "Spr", summer: "Sum" };
const rangeLabel = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() ? `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}` : `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`;

export function RegisterView() {
  const { navigate } = useAppActions();
  const { toast } = useToast();
  const {
    templates, currentTemplateId, setCurrentTemplate, currentTerm, toggleLesson, deleteTemplate, settings,
    gmail, gmailConnected, gmailConnecting, connectGmail, drafting, createAllInvoiceDrafts, draftTemplate, currentInvoice,
  } = useAppStore();

  const [outcomes, setOutcomes] = useState<Record<string, DraftOutcome> | null>(null);
  const [deleting, setDeleting] = useState<InvoiceTemplate | null>(null);
  const [changed, setChanged] = useState<string | null>(null);

  // Always have a family selected when there is one.
  useEffect(() => {
    if (!templates.some((t) => t.id === currentTemplateId) && templates.length > 0) setCurrentTemplate(templates[0].id);
  }, [templates, currentTemplateId, setCurrentTemplate]);

  const now = new Date();
  const year = academicYear(now);
  const weeks = useMemo(() => (currentTerm ? registerWeeks(currentTerm, templates.filter((t) => VALID_DAYS.includes(t.day))) : []), [currentTerm, templates]);
  const current = templates.find((t) => t.id === currentTemplateId) ?? null;
  const nextTerm = [...year.terms, ...getTermsForAcademicYear(year.start + 1)].find((t) => t.startDate > now);

  // Figures always come from the billing code, so the register matches the email exactly.
  const invoices = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generateInvoice>>();
    if (currentTerm) for (const t of templates) if (VALID_DAYS.includes(t.day)) map.set(t.id, generateInvoice(t, currentTerm, settings.customEmailBodyTemplate));
    return map;
  }, [templates, currentTerm, settings.customEmailBodyTemplate]);
  const chargeable = [...invoices.values()].filter((inv) => inv.lessonCount > 0).length;
  const draftWhy = !currentTerm
    ? "It's outside term time."
    : templates.length === 0
      ? "Add a family first."
      : !gmailConnected
        ? "Connect Gmail first."
        : chargeable === 0
          ? "Every lesson is unticked."
          : null;

  const onConnect = async () => {
    try {
      const status = await connectGmail();
      toast({ title: "Gmail connected", description: status.email ? `Drafts will be saved to ${status.email}.` : "Drafts will be saved to your Gmail account." });
    } catch (error) {
      if (isBackendError(error) && error.kind === "Cancelled") return;
      toast({ title: "Gmail wasn't connected", description: errorMessage(error), variant: "destructive" });
    }
  };

  const onDraftAll = async () => {
    setOutcomes({});
    try {
      await createAllInvoiceDrafts((o) => setOutcomes((prev) => ({ ...(prev ?? {}), [o.templateId]: o })));
    } catch (error) {
      setOutcomes(null);
      toast({ title: "Couldn't save the drafts", description: errorMessage(error), variant: "destructive" });
    }
  };

  const onRetry = async (id: string) => {
    setOutcomes((prev) => ({ ...(prev ?? {}), [id]: { templateId: id, status: "saving" } }));
    try {
      await draftTemplate(id);
      setOutcomes((prev) => ({ ...(prev ?? {}), [id]: { templateId: id, status: "saved" } }));
    } catch (error) {
      setOutcomes((prev) => ({ ...(prev ?? {}), [id]: { templateId: id, status: "failed", message: errorMessage(error) } }));
    }
  };

  const onToggle = (t: InvoiceTemplate, key: string) => {
    setCurrentTemplate(t.id);
    toggleLesson(t.id, key);
    setChanged(`${t.id}:${key}`);
  };

  const results = outcomes !== null;
  const list = outcomes ? Object.values(outcomes) : [];
  const saved = list.filter((o) => o.status === "saved").length;
  const finished = results && !drafting;

  return (
    <>
      <header className="band">
        <div data-tour="term">
          <h1>
            {currentTerm
              ? `Register · ${currentTerm.term.half} half ${cap(currentTerm.term.season)} term ${currentTerm.term.startDate.getFullYear()}`
              : "Register · Holiday"}
          </h1>
          <div className="band-meta">
            <span>
              {currentTerm
                ? `${rangeLabel(currentTerm.term.startDate, currentTerm.term.endDate)} · ${currentTerm.weeksCount} weeks`
                : nextTerm
                  ? `The next half-term starts on ${format(nextTerm.startDate, "EEEE d MMMM")}.`
                  : "It's outside term time."}
            </span>
            <div className="terms" role="list" aria-label={`Half-terms in the ${year.start}/${String(year.start + 1).slice(2)} school year`}>
              <span className="terms-yr">
                {year.start}/{String(year.start + 1).slice(2)}
              </span>
              {year.terms.map((t) => {
                const isNow = currentTerm?.term.season === t.season && currentTerm.term.half === t.half && currentTerm.term.startDate.getTime() === t.startDate.getTime();
                return (
                  <span
                    key={`${t.season}-${t.half}`}
                    role="listitem"
                    className={`term${isNow ? " is-now" : ""}`}
                    title={`${t.half} half ${cap(t.season)} term: ${rangeLabel(t.startDate, t.endDate)}`}
                    aria-current={isNow ? "true" : undefined}
                  >
                    {SEASON_SHORT[t.season]} {t.half === "1st" ? 1 : 2}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="band-side" data-tour="draft-all">
          {finished ? (
            <>
              <p className="band-msg">
                <CircleCheck aria-hidden="true" />
                {saved} of {list.filter((o) => o.status !== "nothing").length} saved as drafts in Gmail.
                <span>Check and send them from Gmail.</span>
              </p>
              <button type="button" className="bbtn bbtn--ghost" onClick={() => setOutcomes(null)}>
                Close results
              </button>
            </>
          ) : (
            <>
              {gmail?.configured === false ? (
                <p className="gmail is-off">
                  <MailX aria-hidden="true" /> Gmail isn't set up in this copy of the app
                </p>
              ) : gmailConnected ? (
                <p className="gmail">
                  <MailCheck aria-hidden="true" />
                  <span>
                    Gmail connected{gmail?.email ? " · " : ""}
                    {gmail?.email && <strong>{gmail.email}</strong>}
                  </span>
                </p>
              ) : (
                <button type="button" className="bbtn bbtn--ghost" onClick={onConnect} disabled={gmailConnecting}>
                  <Mail /> Connect Gmail
                </button>
              )}
              <button type="button" className="bbtn" onClick={onDraftAll} disabled={draftWhy !== null || drafting} aria-describedby={draftWhy ? "draft-why" : undefined}>
                {drafting ? <Loader2 className="spin" /> : <Mails />}
                {drafting ? "Saving drafts…" : chargeable > 0 ? `Draft all ${chargeable} in Gmail` : "Draft all in Gmail"}
              </button>
              {draftWhy && (
                <p className="band-why" id="draft-why">
                  {draftWhy}
                </p>
              )}
            </>
          )}
        </div>
      </header>

      <div className={`work${results || templates.length === 0 ? " work--full" : ""}`}>
        <section className="regcol" aria-label="Register">
          {!currentTerm && templates.length > 0 && (
            <p className="holiday-note">
              <CalendarOff aria-hidden="true" />
              It's outside term time, so there are no lessons to invoice today.
            </p>
          )}
          {templates.length === 0 ? (
            <EmptyRegister onAdd={() => navigate({ name: "edit", templateId: null })} onConnect={onConnect} gmailConnected={gmailConnected} />
          ) : (
            <div
              className={`sheet scroll${results ? " has-status" : ""}`}
              style={{ ["--weeks" as string]: Math.max(weeks.length, 1) }}
              role="table"
              aria-label="Families and lessons this half-term"
              data-tour="register"
            >
              <div className="row row--head" role="row">
                <div className="c fam th" role="columnheader">Family</div>
                <div className="c th c-day" role="columnheader">Day</div>
                <div className="c weeks" role="columnheader" aria-label="Weeks">
                  {weeks.map((w) => (
                    <span key={w.monday.getTime()} className={`wk wk-h${w.afterTerm ? " is-holiday" : ""}`} title={w.afterTerm ? `Week of ${format(w.monday, "d MMMM")}: after the half-term has ended` : `Week of ${format(w.monday, "d MMMM")}`}>
                      <b>{format(w.monday, "d")}</b>
                      <span>{format(w.monday, "MMM")}</span>
                    </span>
                  ))}
                </div>
                <div className="c th tcell tb1" role="columnheader">Lessons</div>
                <div className="c th tcell c-per" role="columnheader">Per lesson</div>
                <div className="c th tcell end" role="columnheader">Total</div>
                {results && <div className="c th status" role="columnheader">Gmail draft</div>}
              </div>

              {templates.map((t, index) => {
                const valid = VALID_DAYS.includes(t.day);
                const lessons = currentTerm && valid ? registerLessons(t, currentTerm) : [];
                const inv = invoices.get(t.id);
                const selected = t.id === currentTemplateId;
                const outcome = outcomes?.[t.id];
                const byWeek = new Map(lessons.map((l) => [l.week, l]));
                return (
                  <div
                    key={t.id}
                    role="row"
                    aria-selected={selected}
                    className={[
                      "row is-pupil",
                      selected ? "is-selected" : "",
                      valid ? "" : "is-invalid",
                      outcome?.status === "saved" ? "is-drafted" : "",
                      outcome?.status === "failed" ? "is-failed" : "",
                    ].join(" ")}
                    onClick={() => setCurrentTemplate(t.id)}
                  >
                    <div className="c" role="cell" style={{ padding: 0 }}>
                      <button type="button" className="fam fam-btn c" style={{ width: "100%", height: "100%" }} onClick={() => setCurrentTemplate(t.id)} aria-label={`${t.recipient}: ${t.students}, ${t.instrument}`}>
                        <span className="who">{t.recipient}</span>
                        <span className="what">
                          {t.students} · {cap(t.instrument)}
                          <span className="day-inline"> · {t.day.slice(0, 3)}</span>
                        </span>
                      </button>
                    </div>
                    <div className="c c-day" role="cell">
                      {t.day}
                    </div>
                    <div className="c weeks" role="cell" data-tour={index === templates.findIndex((x) => x.id === currentTemplateId) ? "marks" : undefined}>
                      {weeks.map((w, wi) => {
                        const l = byWeek.get(wi);
                        if (!l) return <span key={wi} className={`wk${w.afterTerm ? " is-holiday" : ""}`} />;
                        const label = format(l.date, "EEEE d MMMM");
                        return (
                          <span key={wi} className={`wk${w.afterTerm ? " is-holiday" : ""}`}>
                            <button
                              type="button"
                              className={`mark${changed === `${t.id}:${l.key}` ? " is-changed" : ""}`}
                              aria-pressed={l.ticked}
                              title={`${format(l.date, "EEE d MMM")}: ${l.ticked ? "lesson" : "no lesson (not charged)"}`}
                              aria-label={l.ticked ? `${label}: lesson. Untick if it didn't happen.` : `${label}: unticked, not charged. Tick to charge it again.`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggle(t, l.key);
                              }}
                            />
                          </span>
                        );
                      })}
                    </div>
                    <div className="c tcell tb1" role="cell">
                      {inv ? (
                        <>
                          {inv.lessonCount}
                          {inv.lessonCount !== lessons.length && <span className="les-of">of {lessons.length}</span>}
                        </>
                      ) : (
                        "–"
                      )}
                    </div>
                    <div className="c tcell c-per" role="cell">
                      {money(t.cost)}
                    </div>
                    <div className="c tcell end tot" role="cell" data-tour={selected ? "totals" : undefined}>
                      {inv ? money(inv.totalCost) : "–"}
                    </div>
                    {results && <StatusCell outcome={outcome} onRetry={() => void onRetry(t.id)} busy={drafting} />}
                  </div>
                );
              })}
              <div className="row row--fill" aria-hidden="true">
                <div className="c" />
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
            </div>
          )}

          {templates.length > 0 && (
            <div className="acts" data-tour="family-actions">
              <button type="button" className="btn btn--secondary" onClick={() => navigate({ name: "edit", templateId: null })}>
                <UserPlus /> Add a family
              </button>
              {current && (
                <>
                  <button type="button" className="btn btn--secondary" onClick={() => navigate({ name: "edit", templateId: current.id })}>
                    <Pencil /> Edit {current.recipient}
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => setDeleting(current)}>
                    <Trash2 /> Delete {current.recipient}…
                  </button>
                </>
              )}
              <p className="legend">
                <span>
                  <i className="legend-mk" aria-hidden="true" /> Lesson
                </span>
                <span>
                  <i className="legend-off" aria-hidden="true" /> Unticked (not charged)
                </span>
                {weeks.some((w) => w.afterTerm) && (
                  <span>
                    <i className="legend-hol" aria-hidden="true" /> After the half-term
                  </span>
                )}
              </p>
            </div>
          )}
        </section>

        {!results && templates.length > 0 && (
          <PupilPage
            template={current}
            invoice={current ? currentInvoice : null}
            lessons={current && currentTerm && VALID_DAYS.includes(current.day) ? registerLessons(current, currentTerm) : []}
            nextTermStart={nextTerm?.startDate ?? null}
          />
        )}
      </div>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete {deleting?.recipient}'s details?</DialogTitle>
          <DialogDescription>
            This removes {deleting?.recipient} ({deleting?.students}) from the register. It can't be undone here, but your automatic backups keep a copy.
          </DialogDescription>
          <DialogActions>
            <button type="button" className="btn btn--secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger-solid"
              onClick={() => {
                if (deleting) {
                  deleteTemplate(deleting.id);
                  toast({ title: "Deleted", description: `${deleting.recipient}'s details were removed.` });
                }
                setDeleting(null);
              }}
            >
              <Trash2 /> Delete
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusCell({ outcome, onRetry, busy }: { outcome?: DraftOutcome; onRetry: () => void; busy: boolean }) {
  if (!outcome) return <div className="c status" role="cell" />;
  switch (outcome.status) {
    case "saving":
      return (
        <div className="c status" role="cell">
          <Loader2 className="spin" /> Saving…
        </div>
      );
    case "saved":
      return (
        <div className="c status status--ok" role="cell">
          <MailPlus /> Draft saved
        </div>
      );
    case "nothing":
      return (
        <div className="c status" role="cell">
          <span className="status-txt">Nothing to invoice</span>
        </div>
      );
    default:
      return (
        <div className="c status status--bad" role="cell">
          <span className="status-txt">
            {outcome.status === "skipped" ? "Not tried" : "Not saved"}
            <span>{outcome.message}</span>
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            <RotateCcw /> Try again
          </button>
        </div>
      );
  }
}

function EmptyRegister({ onAdd, onConnect, gmailConnected }: { onAdd: () => void; onConnect: () => void; gmailConnected: boolean }) {
  return (
    <div className="intro scroll">
      <div className="intro-h">
        <h2>No families on the register yet</h2>
        <p>Here's how Student Invoice works. You only do the first two once.</p>
      </div>
      <div className="step">
        <span className="step-t">
          <span className="step-n">1</span>
          <strong>Add your families</strong>
        </span>
        <p className="step-d">For each family: the name you greet, the pupils, the instrument, the lesson day and the cost per lesson.</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={onAdd} data-tour="family-actions">
          <UserPlus /> Add your first student
        </button>
      </div>
      <div className="step">
        <span className="step-t">
          <span className="step-n">2</span>
          <strong>Connect Gmail</strong>
        </span>
        <p className="step-d">So the app can save your invoices as drafts in your Gmail. It never sends anything itself.</p>
        {gmailConnected ? (
          <span className="ok">
            <CircleCheck /> <strong>Connected</strong>
          </span>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={onConnect}>
            <Mail /> Connect Gmail
          </button>
        )}
      </div>
      <div className="step">
        <span className="step-t">
          <span className="step-n">3</span>
          <strong>At each half-term</strong>
        </span>
        <p className="step-d">Open the app, untick any lessons that didn't happen, press Draft all, then check and send the drafts from Gmail.</p>
        <span />
      </div>
    </div>
  );
}
