// "Your name": the name that signs every invoice email ({{yourName}}; docs/ui.md
// "Your name", docs/proposals/2026-09-your-name-sign-off.md). Empty on a new
// install; nothing is copied or drafted until it's set, if the wording uses it.
import { useId, useState, type FormEvent } from "react";
import { useAppStore } from "../../stores/app-store";

interface FieldProps {
  /** Called after the name is saved. */
  onSaved?: () => void;
  /** Button text. */
  action?: string;
  autoFocus?: boolean;
}

/** A labelled box and Save button for Your name. */
export function YourNameField({ onSaved, action = "Save", autoFocus }: FieldProps) {
  const saved = useAppStore((s) => s.settings.yourName ?? "");
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [value, setValue] = useState(saved);
  const id = useId();
  const name = value.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name) return;
    updateSettings({ yourName: name });
    onSaved?.();
  };

  return (
    <form className="name-field" onSubmit={submit}>
      <label htmlFor={id}>Your name</label>
      <div className="name-field-row">
        <input
          id={id}
          className="field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          autoComplete="name"
          autoFocus={autoFocus}
          aria-describedby={`${id}-hint`}
        />
        <button type="submit" className="btn btn--primary" disabled={!name || name === saved.trim()}>
          {action}
        </button>
      </div>
      <p className="name-field-hint" id={`${id}-hint`}>
        It goes at the end of every invoice email.
      </p>
    </form>
  );
}
