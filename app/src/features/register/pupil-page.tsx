// The pupil's page: the selected family's invoice email, with copy and
// "Save as Gmail draft" (docs/ui.md "Register").
import { format } from "date-fns";
import { Copy, Loader2, MailPlus } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { errorMessage } from "../../lib/backend";
import { capitalise, lessonsWord, money } from "../../lib/format";
import { toast } from "../../hooks/use-toast";
import type { InvoiceTemplate } from "../../types";
import type { InvoiceData } from "../../utils/invoice-generator";
import type { RegisterLesson } from "./weeks";

interface Props {
  template: InvoiceTemplate | null;
  invoice: InvoiceData | null;
  lessons: RegisterLesson[];
  nextTermStart: Date | null;
}

export function PupilPage({ template, invoice, lessons, nextTermStart }: Props) {
  const gmailConnected = useAppStore((s) => s.gmailConnected);
  const drafting = useAppStore((s) => s.drafting);
  const draftTemplate = useAppStore((s) => s.draftTemplate);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `The ${what} is ready to paste.` });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the text and press Ctrl+C instead.", variant: "destructive" });
    }
  };

  const onDraft = async (templateId: string) => {
    try {
      await draftTemplate(templateId);
      toast({ title: "Draft saved", description: "It's in your Gmail drafts, ready to check and send." });
    } catch (error) {
      toast({ title: "Couldn't save the draft", description: errorMessage(error), variant: "destructive" });
    }
  };

  if (!template) {
    return (
      <aside className="slip" aria-label="Invoice">
        <div className="slip-empty">
          <p>Pick a family on the register to see its invoice.</p>
        </div>
      </aside>
    );
  }

  const unticked = lessons.filter((l) => !l.ticked);
  const nothing = invoice?.lessonCount === 0;
  const draftWhy = !invoice
    ? null
    : nothing
      ? "Every lesson is unticked, so there is nothing to invoice."
      : !gmailConnected
        ? "Connect Gmail to save drafts. You can still copy the email."
        : null;

  return (
    <aside className="slip" aria-label={`${template.recipient}'s invoice`} data-tour="pupil">
      <div className="slip-head">
        <div className="slip-id">
          <h2>{template.recipient}</h2>
          <span>
            {template.students} · {capitalise(template.instrument)} · {template.day}
          </span>
        </div>
        {invoice ? (
          <>
            <p className="sum">
              {invoice.lessonCount} {lessonsWord(invoice.lessonCount)} × {money(template.cost)} = <b>{money(invoice.totalCost)}</b>
            </p>
            {unticked.length > 0 && (
              <p className="sum-note">
                Not charged: {unticked.map((l) => format(l.date, "EEE d MMM")).join(", ")}
              </p>
            )}
          </>
        ) : (
          <p className="sum-note">No invoice outside term time.</p>
        )}
      </div>

      {invoice ? (
        <>
          <div className="subj">
            <p>
              <span>Subject</span>
              <strong>{invoice.subject}</strong>
            </p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void copy(invoice.subject, "subject")} disabled={nothing}>
              <Copy /> Copy subject
            </button>
          </div>
          <div className="mail scroll" tabIndex={0} aria-label="Email text">
            {invoice.body}
          </div>
          <div className="slip-bar">
            <button type="button" className="btn btn--secondary" onClick={() => void copy(invoice.body, "email text")} disabled={nothing}>
              <Copy /> Copy email text
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void onDraft(template.id)} disabled={draftWhy !== null || drafting}>
              {drafting ? <Loader2 className="spin" /> : <MailPlus />} Save as Gmail draft
            </button>
            {draftWhy && <p className="slip-why">{draftWhy}</p>}
          </div>
        </>
      ) : (
        <div className="slip-empty">
          <p>
            It's outside term time, so there's no invoice to show.
            {nextTermStart ? ` The next half-term starts on ${format(nextTermStart, "EEEE d MMMM")}.` : ""}
          </p>
        </div>
      )}
    </aside>
  );
}
