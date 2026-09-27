// The family editor's form logic (docs/ui.md): what the fields start as, how
// they are checked, what gets saved, and the "This half-term" preview. The
// rules are v1.0.1's template form, unchanged; the preview calls the billing
// code as it is (docs/billing.md) and never works anything out itself.
import * as z from "zod";
import type { InvoiceTemplate, TermData } from "../../types";
import { isWeekday } from "../../lib/schema/constants";
import { capitalise } from "../../lib/format";
import { generateInvoice, lessonDateKey, lessonDates } from "../../utils/invoice-generator";

/** The instruments offered, stored lowercase exactly as v1.0.1 stored them. */
export const INSTRUMENTS = ["piano", "drum", "guitar", "vocal", "music", "singing", "bass guitar", "classical guitar"] as const;

/** The five things the editor saves. Anything else on a template (such as unticked lessons) is left alone. */
export type FamilyFields = Pick<InvoiceTemplate, "recipient" | "students" | "instrument" | "day" | "cost">;

/** The form's values: everything as typed, the cost included (e.g. "22.50"). */
export interface FamilyFormValues {
  recipient: string;
  students: string;
  instrument: string;
  day: string;
  cost: string;
}

const EMPTY: FamilyFormValues = { recipient: "", students: "", instrument: "", day: "", cost: "" };

/**
 * How a saved cost is shown for editing: with pence ("22.50") when that
 * saves back as exactly the same number, otherwise as stored, so opening and
 * saving a family never changes its cost.
 */
export function costText(cost: number): string {
  if (!Number.isFinite(cost)) return "";
  const fixed = cost.toFixed(2);
  return Number(fixed) === cost ? fixed : String(cost);
}

/** The values the form starts from: the saved family, or blank for a new one. */
export function formValuesFrom(template: InvoiceTemplate | null): FamilyFormValues {
  if (!template) return { ...EMPTY };
  return {
    recipient: template.recipient,
    students: template.students,
    instrument: template.instrument,
    // A day that isn't a weekday can't be shown or billed, so it has to be chosen again.
    day: isWeekday(template.day) ? template.day : "",
    cost: costText(template.cost),
  };
}

/**
 * What's wrong with a typed cost, or null when it's fine. Accepts what
 * v1.0.1's number field (`step="0.01"`) accepted: a number greater than 0, in
 * whole pence, that `parseFloat` saves unchanged (so "0x10" or "Infinity"
 * can't slip through as text).
 */
export function costProblem(text: string): string | null {
  if (text.trim() === "") return "Enter the cost per lesson, e.g. 22.50.";
  const value = Number(text);
  if (!Number.isFinite(value) || parseFloat(text) !== value) return "Enter just the number, e.g. 22.50.";
  if (value <= 0) return "The cost per lesson must be more than £0.";
  // More than two decimal places (12.345) would make the email's sum look wrong.
  if (decimalPlaces(value) > 2) return "Use pounds and pence, e.g. 22.50.";
  return null;
}

/** How many decimal places a number has, written out in full (1e-3 has 3; 22.50 has 1). */
function decimalPlaces(value: number): number {
  // String() gives the shortest form that reads back as the same number, e.g. "1.5e-7".
  const [digits, exponent = "0"] = String(value).split("e");
  return Math.max(0, (digits.split(".")[1]?.length ?? 0) - Number(exponent));
}

const filledIn = (message: string) => z.string().refine((value) => value.trim() !== "", { error: message });

export const familySchema = z.object({
  recipient: filledIn("Enter the name you greet in the email."),
  students: filledIn("Enter the pupils' names."),
  instrument: filledIn("Choose an instrument."),
  day: z.string().refine(isWeekday, { error: "Choose the lesson day." }),
  cost: z.string().superRefine((value, ctx) => {
    const problem = costProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
});

/** True when any field differs from what the form started with (so leaving would lose it). */
export function hasChanges(values: FamilyFormValues, initial: FamilyFormValues): boolean {
  return (Object.keys(initial) as (keyof FamilyFormValues)[]).some((field) => values[field] !== initial[field]);
}

/** What saving stores: the five fields, with the cost read by `parseFloat` as v1.0.1 did. */
export function toFields(values: FamilyFormValues): FamilyFields {
  return {
    // Spaces at either end would show in the email ("Hi Sarah ,").
    recipient: values.recipient.trim(),
    students: values.students.trim(),
    instrument: values.instrument,
    day: values.day,
    cost: parseFloat(values.cost),
  };
}

export interface InstrumentOption {
  value: string;
  label: string;
}

/**
 * The instrument list, plus the family's saved instrument when it isn't on it
 * (e.g. an imported "violin"), so editing never loses it.
 */
export function instrumentOptions(saved: string): InstrumentOption[] {
  const options: InstrumentOption[] = INSTRUMENTS.map((value) => ({ value, label: capitalise(value) }));
  if (saved !== "" && !options.some((o) => o.value === saved)) {
    const label = capitalise(saved);
    const clash = options.some((o) => o.label === label);
    options.push({ value: saved, label: clash ? `${label} (as saved)` : label });
  }
  return options;
}

export interface PreviewLesson {
  date: Date;
  key: string;
  /** Still ticked, so it is charged. */
  charged: boolean;
  /** Falls after the half-term's last day (billing issue B1; shown as the register shows it). */
  afterTerm: boolean;
}

export type FamilyPreview =
  | { kind: "no-term" }
  | { kind: "incomplete" }
  | {
      kind: "ready";
      lessons: PreviewLesson[];
      /** Lessons charged. */
      lessonCount: number;
      cost: number;
      totalCost: number;
      subject: string;
    };

/**
 * This half-term's invoice for the family as it would be saved: the saved
 * template (unticked lessons and all) with the form's five fields on top,
 * exactly what `updateTemplate` would store.
 */
export function previewFor(values: FamilyFormValues, term: TermData | null, saved: InvoiceTemplate | null): FamilyPreview {
  if (!term) return { kind: "no-term" };
  const parsed = familySchema.safeParse(values);
  if (!parsed.success) return { kind: "incomplete" };

  const base: InvoiceTemplate = saved ?? { ...toFields(EMPTY), id: "new", createdAt: new Date(0), updatedAt: new Date(0) };
  const draft: InvoiceTemplate = { ...base, ...toFields(parsed.data) };
  const invoice = generateInvoice(draft, term);
  const skipped = new Set(draft.skippedLessonDates ?? []);
  const lessons = lessonDates(draft, term).map((date) => {
    const key = lessonDateKey(date);
    return { date, key, charged: !skipped.has(key), afterTerm: date > term.term.endDate };
  });
  return {
    kind: "ready",
    lessons,
    lessonCount: invoice.lessonCount,
    cost: draft.cost,
    totalCost: invoice.totalCost,
    subject: invoice.subject,
  };
}
