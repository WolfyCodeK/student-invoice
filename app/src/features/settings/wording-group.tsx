// Settings → Email wording: the body of every invoice email, with the words
// the app fills in (utils/invoice-generator.ts). Only the stored custom
// wording changes here; how it is filled in never does (docs/billing.md).
import { useRef, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { getDefaultTemplateString } from "../../utils/invoice-generator";
import { getTermsForAcademicYear } from "../../utils/terms";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { academicYearStart } from "../../lib/term-display";
import { PLACEHOLDERS, unknownPlaceholders, wordingToSave } from "./settings-logic";

const STANDARD = getDefaultTemplateString();

export function WordingGroup() {
  const stored = useAppStore((s) => s.settings.customEmailBodyTemplate);
  const currentTerm = useAppStore((s) => s.currentTerm);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const box = useRef<HTMLTextAreaElement>(null);

  const savedText = stored || STANDARD;
  const [draft, setDraft] = useState(savedText);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // The stored wording changed elsewhere (saved here, or data replaced): start again from it.
  const [lastStored, setLastStored] = useState(stored);
  if (stored !== lastStored) {
    setLastStored(stored);
    setDraft(stored || STANDARD);
  }

  const changed = draft !== savedText;
  const unknown = unknownPlaceholders(draft);
  // An example of {{termInfo}}, written the way the invoice writes it.
  const example = currentTerm?.term ?? getTermsForAcademicYear(academicYearStart(new Date()))[0];
  const termInfoExample = `${example.half} half ${example.season} term ${example.startDate.getFullYear()}`;

  const edit = (text: string) => {
    setDraft(text);
    setSavedMsg(null);
  };

  const save = () => {
    const next = wordingToSave(draft, STANDARD);
    updateSettings({ customEmailBodyTemplate: next });
    setDraft(next ?? STANDARD);
    setSavedMsg(next ? "Saved. Every invoice email now uses this wording." : "Saved. Invoice emails use the standard wording.");
  };

  const resetToStandard = () => {
    updateSettings({ customEmailBodyTemplate: undefined });
    setDraft(STANDARD);
    setConfirmReset(false);
    setSavedMsg("Invoice emails use the standard wording again.");
  };

  /** Puts a placeholder where the cursor is in the box. */
  const insert = (token: string) => {
    const el = box.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    edit(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const placeholders = Object.entries(PLACEHOLDERS).map(([name, meaning]): [token: string, meaning: string] => [
    `{{${name}}}`,
    name === "termInfo" ? `${meaning}, e.g. "${termInfoExample}"` : meaning,
  ]);

  return (
    <div className="tpl">
      <div className="tpl-col">
        <div className="slab">
          <label htmlFor="st-wording">
            <strong>Invoice email</strong>
          </label>
          <span id="st-wording-hint">
            {stored ? "Your own wording." : "The standard wording."} Words in double curly brackets are filled in for each family.
          </span>
        </div>
        <textarea
          id="st-wording"
          ref={box}
          className="field st-wording"
          rows={16}
          value={draft}
          onChange={(e) => edit(e.target.value)}
          placeholder="Leave this empty to use the standard wording."
          aria-describedby="st-wording-hint st-wording-warn"
        />
        <p className="st-warn" id="st-wording-warn">
          <TriangleAlert aria-hidden="true" />
          This wording is used for every invoice email.
        </p>
        {unknown.length > 0 && (
          <p className="msg-bad" role="alert">
            The app doesn't fill in {unknown.join(", ")}, so {unknown.length === 1 ? "it" : "they"} would appear in the email exactly as typed.
            Check the spelling against the list.
          </p>
        )}
        <div className="sctl">
          <button
            type="button"
            className="btn btn--primary"
            onClick={save}
            disabled={!changed}
            data-tip={changed ? undefined : "Nothing to save: the wording hasn't changed"}
            data-tip-side="left"
          >
            Save wording
          </button>
          {stored && (
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmReset(true)}>
              Use the standard wording
            </button>
          )}
          <p className="st-save-state" role="status">
            {changed ? (
              <span className="st-unsaved">Not saved yet</span>
            ) : (
              savedMsg && (
                <span className="ok">
                  <CircleCheck aria-hidden="true" />
                  {savedMsg}
                </span>
              )
            )}
          </p>
        </div>
      </div>

      <div className="tpl-col">
        <div className="slab">
          <strong id="st-ph-title">What each one becomes</strong>
          <span>Click one to add it where the cursor is.</span>
        </div>
        <ul className="phlist" aria-labelledby="st-ph-title">
          {placeholders.map(([token, meaning]) => (
            <li key={token}>
              <button type="button" className="st-ph" onClick={() => insert(token)} aria-label={`Add ${token} (${meaning}) to the wording`}>
                <code>{token}</code>
                <span>{meaning}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogTitle>Use the standard wording?</DialogTitle>
          <DialogDescription>
            Your own wording will be removed, and every invoice email will use the standard wording again. If you might want your wording
            later, copy it somewhere safe first.
          </DialogDescription>
          <DialogActions>
            <DialogClose asChild>
              <button type="button" className="btn btn--secondary">
                Keep my wording
              </button>
            </DialogClose>
            <button type="button" className="btn btn--primary" onClick={resetToStandard}>
              Use the standard wording
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}
