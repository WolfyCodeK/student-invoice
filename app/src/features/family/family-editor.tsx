// The family editor (docs/ui.md): add a family, or change or delete one.
// A family is one invoice template. App.tsx loads this screen lazily and keys
// it by the family, so the form always starts from the saved values.
import { useId, useMemo, useState, type CSSProperties } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Check, Plus, Trash2 } from "lucide-react";
import type { InvoiceTemplate } from "../../types";
import { useAppStore } from "../../stores/app-store";
import { toast } from "../../hooks/use-toast";
import { capitalise, lessonsWord, money } from "../../lib/format";
import { MAX_LENGTH, WEEKDAYS } from "../../lib/schema/constants";
import { useAppActions, useLeaveGuard } from "../app-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { DeleteFamilyDialog } from "./delete-family-dialog";
import {
  familySchema,
  formValuesFrom,
  hasChanges,
  instrumentOptions,
  previewFor,
  toFields,
  type FamilyFormValues,
  type FamilyPreview,
} from "./family-form";
import "./family-editor.css";

const BAND_LINE = "One family per invoice: the parent you greet and the pupils you teach them.";

export function FamilyEditor() {
  const { view, back } = useAppActions();
  const templateId = view.name === "edit" ? view.templateId : null;
  const template = useAppStore((s) => (templateId === null ? null : (s.templates.find((t) => t.id === templateId) ?? null)));

  if (templateId !== null && template === null) return <MissingFamily onBack={back} />;
  return <FamilyForm template={template} />;
}

function FamilyForm({ template }: { template: InvoiceTemplate | null }) {
  const { back } = useAppActions();
  const addTemplate = useAppStore((s) => s.addTemplate);
  const updateTemplate = useAppStore((s) => s.updateTemplate);
  const setCurrentTemplate = useAppStore((s) => s.setCurrentTemplate);
  const currentTerm = useAppStore((s) => s.currentTerm);

  const uid = useId();
  const ids = {
    head: `${uid}-head`,
    recipient: `${uid}-recipient`,
    students: `${uid}-students`,
    lessons: `${uid}-lessons`,
    instrument: `${uid}-instrument`,
    day: `${uid}-day`,
    cost: `${uid}-cost`,
    danger: `${uid}-danger`,
  };
  const hint = (field: string) => `${uid}-${field}-hint`;
  const errorId = (field: string) => `${uid}-${field}-error`;

  // Captured once: the form starts from the saved values and keeps whatever
  // is typed from then on.
  const [initial] = useState(() => formValuesFrom(template));
  const [instruments] = useState(() => instrumentOptions(initial.instrument));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FamilyFormValues>({ resolver: zodResolver(familySchema), defaultValues: initial });

  const [recipient, students, instrument, day, cost] = useWatch({ control, name: ["recipient", "students", "instrument", "day", "cost"] });
  const values = useMemo(() => ({ recipient, students, instrument, day, cost }), [recipient, students, instrument, day, cost]);
  const preview = useMemo(() => previewFor(values, currentTerm, template), [values, currentTerm, template]);
  // Back, Settings and Help ask before throwing away what's been typed.
  const leaveAnyway = useLeaveGuard(hasChanges(values, initial));
  /** Leaves on purpose (saved, cancelled or deleted), without asking. */
  const leave = () => {
    leaveAnyway();
    back();
  };

  const describedBy = (field: keyof FamilyFormValues, withHint = true) =>
    [withHint ? hint(field) : "", errors[field] ? errorId(field) : ""].filter(Boolean).join(" ") || undefined;

  const onSave = (data: FamilyFormValues) => {
    const fields = toFields(data);
    if (template) {
      updateTemplate(template.id, fields);
      setCurrentTemplate(template.id);
      toast({ title: "Saved", description: `${fields.recipient}'s details are up to date.` });
    } else {
      // addTemplate also makes the new family the selected one.
      addTemplate(fields);
      toast({ title: "Saved", description: `${fields.recipient} is on the register.` });
    }
    leave();
  };

  return (
    <>
      <header className="band fe-band">
        <div>
          <h1>{template ? `Editing ${template.recipient}'s details` : "Add a family"}</h1>
          <div className="band-meta">
            <span>{BAND_LINE}</span>
          </div>
        </div>
      </header>

      <div className="edit scroll fe-page">
        <div className="edit-main">
          <form className="record" aria-labelledby={ids.head} noValidate onSubmit={handleSubmit(onSave)}>
            <div className="record-head">
              <h2 id={ids.head}>Family details</h2>
              <p>Used to write this family's invoice at every half-term.</p>
            </div>

            <div className="frow">
              <div className="flab">
                <label htmlFor={ids.recipient}>Who you write to</label>
                <span id={hint("recipient")}>The name you greet in the email, e.g. Sarah</span>
              </div>
              <div className="fe-ctl">
                <input
                  id={ids.recipient}
                  className="field"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  // A new family starts with nothing to read, so go straight to typing.
                  autoFocus={!template}
                  maxLength={MAX_LENGTH.recipient}
                  aria-invalid={errors.recipient ? true : undefined}
                  aria-describedby={describedBy("recipient")}
                  {...register("recipient")}
                />
                <FieldError id={errorId("recipient")} message={errors.recipient?.message} />
              </div>
            </div>

            <div className="frow">
              <div className="flab">
                <label htmlFor={ids.students}>Pupils</label>
                <span id={hint("students")}>Pupils' names as they appear in the email, e.g. Amara and Tobi</span>
              </div>
              <div className="fe-ctl">
                <input
                  id={ids.students}
                  className="field"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={MAX_LENGTH.students}
                  aria-invalid={errors.students ? true : undefined}
                  aria-describedby={describedBy("students")}
                  {...register("students")}
                />
                <FieldError id={errorId("students")} message={errors.students?.message} />
              </div>
            </div>

            <div className="frow">
              <div className="flab">
                <strong id={ids.lessons}>Instrument and day</strong>
                <span id={hint("lessons")}>Pick one from each list</span>
              </div>
              <div className="duo" role="group" aria-labelledby={ids.lessons}>
                <div className="fe-ctl">
                  <label className="visually-hidden" htmlFor={ids.instrument}>
                    Instrument
                  </label>
                  <Controller
                    control={control}
                    name="instrument"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          ref={field.ref}
                          id={ids.instrument}
                          onBlur={field.onBlur}
                          aria-invalid={errors.instrument ? true : undefined}
                          aria-describedby={describedBy("instrument", false)}
                        >
                          <SelectValue placeholder="Instrument" />
                        </SelectTrigger>
                        <SelectContent>
                          {instruments.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id={errorId("instrument")} message={errors.instrument?.message} />
                </div>
                <div className="fe-ctl">
                  <label className="visually-hidden" htmlFor={ids.day}>
                    Lesson day
                  </label>
                  <Controller
                    control={control}
                    name="day"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          ref={field.ref}
                          id={ids.day}
                          onBlur={field.onBlur}
                          aria-invalid={errors.day ? true : undefined}
                          aria-describedby={describedBy("day", false)}
                        >
                          <SelectValue placeholder="Lesson day" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id={errorId("day")} message={errors.day?.message} />
                </div>
              </div>
            </div>

            <div className="frow">
              <div className="flab">
                <label htmlFor={ids.cost}>Cost per lesson</label>
                <span id={hint("cost")}>In pounds, e.g. 22.50</span>
              </div>
              <div className="fe-ctl">
                <div className="field-money">
                  <span aria-hidden="true">£</span>
                  <input
                    id={ids.cost}
                    className="field"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={errors.cost ? true : undefined}
                    aria-describedby={describedBy("cost")}
                    {...register("cost")}
                  />
                </div>
                <FieldError id={errorId("cost")} message={errors.cost?.message} />
              </div>
            </div>

            <div className="record-bar">
              <button type="button" className="btn btn--secondary btn--lg" onClick={leave}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary btn--lg">
                {template ? (
                  <>
                    <Check aria-hidden="true" /> Save changes
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" /> Add family
                  </>
                )}
              </button>
            </div>
          </form>

          {template && (
            <section className="danger-zone" aria-labelledby={ids.danger}>
              <div>
                <strong id={ids.danger}>Delete {template.recipient}'s details</strong>
                <span>Removes this family from the register. A backup is saved first.</span>
              </div>
              <button type="button" className="btn btn--danger" aria-describedby={ids.danger} onClick={() => setConfirmingDelete(true)}>
                <Trash2 aria-hidden="true" /> Delete…
              </button>
            </section>
          )}
        </div>

        <InvoicePreview preview={preview} values={values} />
      </div>

      <DeleteFamilyDialog family={template} open={confirmingDelete} onOpenChange={setConfirmingDelete} beforeDelete={leave} />
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

/** "This half-term": the family's invoice as it would be with these details. */
function InvoicePreview({ preview, values }: { preview: FamilyPreview; values: FamilyFormValues }) {
  const headId = useId();
  return (
    <aside className="edit-side" aria-labelledby={headId}>
      <h2 id={headId}>This half-term</h2>
      <p>What this family's invoice will say with these details.</p>
      <div className="mini">
        {preview.kind === "ready" ? (
          <ReadyPreview preview={preview} values={values} />
        ) : (
          <div className="mini-sum">
            <p>
              {preview.kind === "no-term"
                ? "It's outside term time, so there's no invoice to preview."
                : "Fill in the details to see this half-term's invoice."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function ReadyPreview({ preview, values }: { preview: Extract<FamilyPreview, { kind: "ready" }>; values: FamilyFormValues }) {
  const { lessons, lessonCount, cost, totalCost, subject } = preview;
  const unticked = lessons.filter((l) => !l.charged).length;
  const marksLabel = `${lessons.length} ${lessonsWord(lessons.length)} this half-term: ${lessons
    .map((l) => `${format(l.date, "d MMMM")}${l.charged ? "" : " (unticked)"}`)
    .join(", ")}`;

  return (
    <>
      <div className="mini-id">
        <strong>{values.recipient}</strong>
        <span>
          {values.students} · {capitalise(values.instrument)} on {values.day}s
        </span>
      </div>
      <div className="fe-weeks" role="img" aria-label={marksLabel} style={{ "--n": lessons.length } as CSSProperties}>
        {lessons.map((l) => (
          <div
            key={l.key}
            className={`fe-wk${l.afterTerm ? " is-after" : ""}`}
            title={`${format(l.date, "EEEE d MMMM")}${l.charged ? "" : ": unticked, not charged"}${l.afterTerm ? " (after the half-term ends; still charged)" : ""}`}
          >
            <span className="wk-h">
              <b>{format(l.date, "d")}</b>
              <span>{format(l.date, "MMM")}</span>
            </span>
            <span className={`fe-mk${l.charged ? "" : " is-off"}`} />
          </div>
        ))}
      </div>
      <div className="mini-sum">
        {lessonCount === 0 ? (
          <p>Every lesson is unticked, so there's nothing to invoice this half-term.</p>
        ) : (
          <>
            <div className="sum">
              {lessonCount} {lessonsWord(lessonCount)} × {money(cost)} = <b>{money(totalCost)}</b>
            </div>
            {unticked > 0 && (
              <div className="sum-note">
                Not counting {unticked} unticked {lessonsWord(unticked)}.
              </div>
            )}
            <p className="fe-subj">
              Subject: <strong>{subject}</strong>
            </p>
          </>
        )}
      </div>
    </>
  );
}

function MissingFamily({ onBack }: { onBack: () => void }) {
  return (
    <>
      <header className="band fe-band">
        <h1>Family not found</h1>
      </header>
      <div className="edit scroll fe-page">
        <div className="edit-main">
          <section className="record" aria-labelledby="fe-missing">
            <div className="record-head">
              <h2 id="fe-missing">This family isn't on the register any more</h2>
              <p>It may have been deleted, or replaced when data was imported. Nothing has been changed.</p>
            </div>
            <div className="record-bar">
              <button type="button" className="btn btn--primary btn--lg" onClick={onBack}>
                Back to the register
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
