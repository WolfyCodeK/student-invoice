// Your name, for components that send or copy emails: whether it's still
// needed, and a gate that asks for it before carrying on (your-name-field.tsx).
import { useCallback, useState } from "react";
import { needsYourName, useAppStore } from "../../stores/app-store";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { YourNameField } from "./your-name-field";

/** True while emails can't go out because they need a name that isn't set. */
export function useNeedsYourName(): boolean {
  return useAppStore((s) => needsYourName(s.settings));
}

/**
 * Runs an action that sends or copies an email, asking for Your name first if
 * it's needed, then carrying on. Render `dialog` once in the component.
 */
export function useYourNameGate() {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const gate = useCallback((action: () => void) => {
    if (needsYourName(useAppStore.getState().settings)) setPending(() => action);
    else action();
  }, []);

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent>
        <DialogTitle>Add your name first</DialogTitle>
        <DialogDescription>
          Your invoice emails end with your name. Add it once and every email uses it. You can change it later in Settings, under Email
          wording.
        </DialogDescription>
        <YourNameField
          autoFocus
          action="Save and carry on"
          onSaved={() => {
            const action = pending;
            setPending(null);
            action?.();
          }}
        />
        <DialogActions>
          <DialogClose asChild>
            <button type="button" className="btn btn--secondary">
              Cancel
            </button>
          </DialogClose>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );

  return { gate, dialog };
}
