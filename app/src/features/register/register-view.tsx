// The main screen: the register for the current half-term (docs/ui.md
// "Register"). One row per family, one column per week, one mark per lesson;
// clicking a mark unticks a lesson that didn't happen (docs/billing.md).
import { memo, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useShallow } from "zustand/react/shallow";
import { CalendarOff, CircleCheck, Loader2, Mail, MailCheck, MailPlus, Mails, MailX, Pencil, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { invoiceFor, useAppStore, type DraftOutcome } from "../../stores/app-store";
import { getTermsForAcademicYear } from "../../utils/terms";
import type { InvoiceData } from "../../utils/invoice-generator";
import { errorMessage } from "../../lib/backend";
import { capitalise, money } from "../../lib/format";
import { isWeekday } from "../../lib/schema/constants";
import { academicYearStart, isSameTerm, nextTermAfter, schoolYearLabel, termRange } from "../../lib/term-display";
import { toast } from "../../hooks/use-toast";
import { useAppActions } from "../app-context";
import { useConnectGmail } from "../gmail/use-connect-gmail";
import { DeleteFamilyDialog } from "../family/delete-family-dialog";
import { registerLessons, registerWeeks, type RegisterLesson } from "./weeks";
import { PupilPage } from "./pupil-page";
import { useYourNameGate } from "../your-name/use-your-name";
import type { InvoiceTemplate } from "../../types";

const SEASON_SHORT: Record<string, string> = { autumn: "Aut", spring: "Spr", summer: "Sum" };

export const RegisterView = memo(function RegisterView() {
  const { navigate } = useAppActions();
  const {
    templates, currentTemplateId, setCurrentTemplate, currentTerm, toggleLesson, customBody, yourName, termDates,
    gmail, gmailConnecting, drafting, outcomes, createAllInvoiceDrafts, draftTemplate, closeDraftResults,
  } = useAppStore(
    useShallow((s) => ({
      templates: s.templates,
      currentTemplateId: s.currentTemplateId,
      setCurrentTemplate: s.setCurrentTemplate,
      currentTerm: s.currentTerm,
      toggleLesson: s.toggleLesson,
      customBody: s.settings.customEmailBodyTemplate,
      yourName: s.settings.yourName,
      termDates: s.settings.termDates,
      gmail: s.gmail,
      gmailConnecting: s.gmailConnecting,
      drafting: s.drafting,
      // Draft all's results live in the store, so they survive going to Settings and back.
      outcomes: s.draftResults,
      createAllInvoiceDrafts: s.createAllInvoiceDrafts,
      draftTemplate: s.draftTemplate,
      closeDraftResults: s.closeDraftResults,
    })),
  );
  const onConnect = useConnectGmail();
  // The live status from Rust (the stored flag can be out of date until it arrives).
  const checkingGmail = gmail === null;
  const gmailConnected = gmail?.connected ?? false;

  const [deleting, setDeleting] = useState<InvoiceTemplate | null>(null);
  const [changed, setChanged] = useState<string | null>(null);

  // Always have a family selected when there is one.
  useEffect(() => {
    if (!templates.some((t) => t.id === currentTemplateId) && templates.length > 0) setCurrentTemplate(templates[0].id);
  }, [templates, currentTemplateId, setCurrentTemplate]);

  const now = new Date();
  const yearStart = academicYearStart(now, termDates);
  const yearLabel = schoolYearLabel(yearStart);
  const weeks = useMemo(() => (currentTerm ? registerWeeks(currentTerm, templates.filter((t) => isWeekday(t.day))) : []), [currentTerm, templates]);
  const current = templates.find((t) => t.id === currentTemplateId) ?? null;
  const nextTerm = nextTermAfter(now, termDates);

  // Figures always come from the billing code, so the register matches the email exactly.
  const invoices = useMemo(() => {
    const map = new Map<string, InvoiceData>();
    for (const t of templates) {
      const invoice = invoiceFor(t, currentTerm, { customEmailBodyTemplate: customBody, yourName });
      if (invoice) map.set(t.id, invoice);
    }
    return map;
  }, [templates, currentTerm, customBody, yourName]);
  const lessonsById = useMemo(() => {
    const map = new Map<string, RegisterLesson[]>();
    if (currentTerm) for (const t of templates) if (isWeekday(t.day)) map.set(t.id, registerLessons(t, currentTerm));
    return map;
  }, [templates, currentTerm]);
  const chargeable = [...invoices.values()].filter((inv) => inv.lessonCount > 0).length;
  const draftWhy = !currentTerm
    ? "It's outside term time."
    : templates.length === 0
      ? "Add a family first."
      : checkingGmail
        ? null // the Gmail line says "Checking Gmail…"
        : !gmailConnected
          ? "Connect Gmail first."
          : chargeable === 0
            ? "Every lesson is unticked."
            : null;

  const { gate, dialog: askName } = useYourNameGate();

  /** Draft all, or (with `remainingOnly`) only the families not saved yet in the results showing. */
  const onDraftAll = async (remainingOnly = false) => {
    try {
      await createAllInvoiceDrafts({ remainingOnly });
    } catch (error) {
      toast({ title: "Couldn't save the drafts", description: errorMessage(error), variant: "destructive" });
    }
  };

  const onRetry = async (templateId: string) => {
    try {
      await draftTemplate(templateId);
    } catch {
      // The row shows what went wrong.
    }
  };

  const select = (id: string) => {
    if (id !== currentTemplateId) setCurrentTemplate(id);
  };

  const onToggle = (t: InvoiceTemplate, key: string) => {
    select(t.id);
    toggleLesson(t.id, key);
    setChanged(`${t.id}:${key}`);
  };

  const results = outcomes !== null;
  // Only families still on the register count.
  const list = outcomes ? templates.flatMap((t) => outcomes[t.id] ?? []) : [];
  const saved = list.filter((o) => o.status === "saved").length;
  const finished = results && !drafting;
  // Families with something to invoice that haven't been saved in these results yet.
  const remaining = outcomes
    ? templates.filter((t) => (invoices.get(t.id)?.lessonCount ?? 0) > 0 && outcomes[t.id]?.status !== "saved").length
    : 0;
  // While drafts are being saved, nothing that changes an invoice can be used.
  const lockedWhy = drafting ? "Families and lessons can't be changed while saving to Gmail." : undefined;

  return (
    <>
      <header className="band">
        <div data-tour="term">
          <h1>
            {currentTerm
              ? `Register · ${currentTerm.term.half} half ${capitalise(currentTerm.term.season)} term ${currentTerm.term.startDate.getFullYear()}`
              : "Register · Holiday"}
          </h1>
          <div className="band-meta">
            <span>
              {currentTerm
                ? `${termRange(currentTerm.term.startDate, currentTerm.term.endDate)} · ${currentTerm.weeksCount} weeks`
                : nextTerm
                  ? `The next half-term starts on ${format(nextTerm.startDate, "EEEE d MMMM")}.`
                  : "It's outside term time."}
            </span>
            <div className="terms" role="list" aria-label={`Half-terms in the ${yearLabel} school year`}>
              <span className="terms-yr">{yearLabel}</span>
              {getTermsForAcademicYear(yearStart, termDates).map((t) => {
                const isNow = isSameTerm(currentTerm?.term, t);
                return (
                  <span
                    key={`${t.season}-${t.half}`}
                    role="listitem"
                    className={`term${isNow ? " is-now" : ""}`}
                    title={`${t.half} half ${capitalise(t.season)} term: ${termRange(t.startDate, t.endDate)}`}
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
              {!gmailConnected && gmail?.configured !== false && (
                <button type="button" className="bbtn" onClick={onConnect} disabled={gmailConnecting}>
                  <Mail /> Connect Gmail
                </button>
              )}
              {remaining > 0 && (
                <button
                  type="button"
                  className={gmailConnected ? "bbtn" : "bbtn bbtn--ghost"}
                  onClick={() => gate(() => void onDraftAll(true))}
                  disabled={!gmailConnected}
                  aria-describedby={gmailConnected ? undefined : "draft-why"}
                >
                  <Mails /> Draft the remaining {remaining} in Gmail
                </button>
              )}
              <button type="button" className="bbtn bbtn--ghost" onClick={closeDraftResults}>
                Close results
              </button>
              {remaining > 0 && !gmailConnected && (
                <p className="band-why" id="draft-why">
                  Connect Gmail first, then draft the rest.
                </p>
              )}
            </>
          ) : (
            <>
              {checkingGmail ? (
                <p className="gmail">
                  <Loader2 className="spin" aria-hidden="true" /> Checking Gmail…
                </p>
              ) : gmail.configured === false ? (
                <p className="gmail is-off">
                  <MailX aria-hidden="true" /> Gmail isn't set up in this copy of the app
                </p>
              ) : gmailConnected ? (
                <p className="gmail">
                  <MailCheck aria-hidden="true" />
                  <span>
                    Gmail connected{gmail.email ? " · " : ""}
                    {gmail.email && <strong>{gmail.email}</strong>}
                  </span>
                </p>
              ) : (
                <button type="button" className="bbtn" onClick={onConnect} disabled={gmailConnecting}>
                  <Mail /> Connect Gmail
                </button>
              )}
              <button
                type="button"
                className={gmailConnected ? "bbtn" : "bbtn bbtn--ghost"}
                onClick={() => gate(() => void onDraftAll())}
                disabled={draftWhy !== null || checkingGmail || drafting}
                aria-describedby={draftWhy ? "draft-why" : undefined}
              >
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
                    <span key={w.monday.getTime()} className={`wk wk-h${w.afterTerm ? " is-holiday" : ""}`} title={w.afterTerm ? `Week of ${format(w.monday, "d MMMM")}: after the half-term ends. A lesson here is still charged.` : `Week of ${format(w.monday, "d MMMM")}`}>
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

              {templates.map((t) => {
                const valid = isWeekday(t.day);
                const lessons = lessonsById.get(t.id) ?? [];
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
                    onClick={() => select(t.id)}
                  >
                    <div className="c" role="cell" style={{ padding: 0 }}>
                      {/* Selects the family through the row's click handler. */}
                      <button type="button" className="fam fam-btn c" aria-label={`${t.recipient}: ${t.students}, ${t.instrument}`}>
                        <span className="who">{t.recipient}</span>
                        <span className="what">
                          {t.students} · {capitalise(t.instrument)}
                          <span className="day-inline"> · {t.day.slice(0, 3)}</span>
                        </span>
                      </button>
                    </div>
                    <div className="c c-day" role="cell">
                      {t.day}
                    </div>
                    <div className="c weeks" role="cell" data-tour={selected ? "marks" : undefined}>
                      {weeks.map((w, wi) => {
                        const l = byWeek.get(wi);
                        if (!l) return <span key={wi} className={`wk${w.afterTerm ? " is-holiday" : ""}`} />;
                        const label = format(l.date, "EEEE d MMMM");
                        return (
                          <span key={wi} className="wk">
                            <button
                              type="button"
                              className={`mark${changed === `${t.id}:${l.key}` ? " is-changed" : ""}`}
                              aria-pressed={l.ticked}
                              disabled={drafting}
                              title={`${format(l.date, "EEE d MMM")}: ${l.ticked ? "lesson" : "no lesson (not charged)"}${lockedWhy ? `. ${lockedWhy}` : ""}`}
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
                    {results && (
                      <StatusCell outcome={outcome} onRetry={() => gate(() => void onRetry(t.id))} busy={drafting} gmailConnected={gmailConnected} />
                    )}
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
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => navigate({ name: "edit", templateId: null })}
                disabled={drafting}
                aria-describedby={lockedWhy ? "acts-why" : undefined}
              >
                <UserPlus /> Add a family
              </button>
              {current && (
                <>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => navigate({ name: "edit", templateId: current.id })}
                    disabled={drafting}
                    aria-describedby={lockedWhy ? "acts-why" : undefined}
                  >
                    <Pencil /> Edit {current.recipient}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setDeleting(current)}
                    disabled={drafting}
                    aria-describedby={lockedWhy ? "acts-why" : undefined}
                  >
                    <Trash2 /> Delete {current.recipient}…
                  </button>
                </>
              )}
              {lockedWhy && (
                <p className="acts-why" id="acts-why">
                  {lockedWhy}
                </p>
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
                    <i className="legend-hol" aria-hidden="true" /> After the half-term ends (a lesson there is still charged)
                  </span>
                )}
              </p>
            </div>
          )}
        </section>

        {!results && templates.length > 0 && (
          <PupilPage
            template={current}
            invoice={current ? (invoices.get(current.id) ?? null) : null}
            lessons={current ? (lessonsById.get(current.id) ?? []) : []}
            nextTermStart={nextTerm?.startDate ?? null}
          />
        )}
      </div>

      {askName}
      <DeleteFamilyDialog family={deleting} open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} />
    </>
  );
});

function StatusCell({ outcome, onRetry, busy, gmailConnected }: { outcome?: DraftOutcome; onRetry: () => void; busy: boolean; gmailConnected: boolean }) {
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
            disabled={busy || !gmailConnected}
            title={gmailConnected ? undefined : "Connect Gmail first."}
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
          <UserPlus /> Add your first family
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
