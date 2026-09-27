// "Choose how it looks" (docs/ui.md "What's new and the tour"): after the
// v1.1.0 update, between What's new and the tour. A centred dialog over the
// dimmed register, like What's new; the register behind it changes as each
// choice is made. The choices are Settings → Appearance's
// (features/settings/appearance-options.tsx) and save the same way.
import { useId } from "react";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="look"
        // Shown only once, so a stray click outside must not skip it.
        onInteractOutside={(event) => event.preventDefault()}
        // The tour takes focus next; don't hand it back to the page first.
        onCloseAutoFocus={(event) => {
          if (hasTourNext) event.preventDefault();
        }}
      >
        <DialogTitle>Choose how it looks</DialogTitle>
        <DialogDescription>Try each one and watch the register change behind this box. You can change these any time in Settings.</DialogDescription>
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
        <DialogActions>
          <button type="button" className="btn btn--primary btn--lg" onClick={onClose}>
            {hasTourNext ? "Show me around" : "Done"}
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
