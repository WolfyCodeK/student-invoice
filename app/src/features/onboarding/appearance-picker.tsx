// "Choose how it looks" (docs/ui.md "What's new and the tour"): after the
// v1.1.0 update, between What's new and the tour. A small panel docked over
// the pupil's page. The register is not dimmed, so every choice shows on it
// straight away. The choices are Settings → Appearance's
// (features/settings/appearance-options.tsx) and save the same way.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId } from "react";
import { RadioGroup } from "../settings/radio-group";
import { CORNER_OPTIONS, MODE_OPTIONS, SCHEME_OPTIONS, useAppearance } from "../settings/appearance-options";
import "./appearance-picker.css";

export interface AppearancePickerProps {
  open: boolean;
  /** The guided tour starts when this closes. */
  hasTourNext: boolean;
  /** Done or dismissed (Escape): whatever is picked stays. */
  onClose: () => void;
}

export function AppearancePicker({ open, hasTourNext, onClose }: AppearancePickerProps) {
  const id = useId();
  const [current, setAppearance] = useAppearance();

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Clear, not dimmed, so the register shows through. It still stops stray clicks. */}
        <DialogPrimitive.Overlay className="look-overlay" />
        <DialogPrimitive.Content
          className="look"
          // A stray click on the register must not skip this.
          onInteractOutside={(event) => event.preventDefault()}
          // The tour takes focus next; don't hand it back to the page first.
          onCloseAutoFocus={(event) => {
            if (hasTourNext) event.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="look-title">Choose how it looks</DialogPrimitive.Title>
          <DialogPrimitive.Description className="look-desc">
            Try each one and watch the register change. You can change these any time in Settings.
          </DialogPrimitive.Description>
          <div className="look-grp">
            <strong id={`${id}-colours`}>Colours</strong>
            <RadioGroup
              labelledBy={`${id}-colours`}
              className="look-choices"
              itemClassName="choice"
              value={current.scheme}
              options={SCHEME_OPTIONS}
              onChange={(scheme) => setAppearance({ scheme })}
            />
          </div>
          <div className="look-grp">
            <strong id={`${id}-corners`}>Corners</strong>
            <RadioGroup
              labelledBy={`${id}-corners`}
              className="look-choices"
              itemClassName="choice"
              value={current.corners}
              options={CORNER_OPTIONS}
              onChange={(corners) => setAppearance({ corners })}
            />
          </div>
          <div className="look-grp look-grp--row">
            <strong id={`${id}-mode`}>Light or dark</strong>
            <RadioGroup labelledBy={`${id}-mode`} className="seg" value={current.mode} options={MODE_OPTIONS} onChange={(mode) => setAppearance({ mode })} />
          </div>
          <div className="look-bar">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              {hasTourNext ? "Show me around" : "Done"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
