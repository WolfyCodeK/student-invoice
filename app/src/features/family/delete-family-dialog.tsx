// "Delete Sarah's details?": the confirmation before a family is deleted, from
// the register or the family editor (docs/ui.md). A `pre-delete` automatic
// backup is saved first; if it can't be, nothing is deleted (docs/backup.md).
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { errorMessage } from "../../lib/backend";
import { toast } from "../../hooks/use-toast";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import type { InvoiceTemplate } from "../../types";

interface Props {
  family: InvoiceTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs just before the family is deleted (the editor goes back to the register). */
  beforeDelete?: () => void;
}

export function DeleteFamilyDialog({ family, open, onOpenChange, beforeDelete }: Props) {
  const deleteFamily = useAppStore((s) => s.deleteFamily);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const onDelete = async () => {
    if (!family) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFamily(family.id, () => {
        onOpenChange(false);
        beforeDelete?.();
      });
      toast({ title: "Deleted", description: `${family.recipient}'s details were removed.` });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogTitle>Delete {family?.recipient}'s details?</DialogTitle>
        <DialogDescription>
          This removes {family?.recipient} ({family?.students}) from the register. A backup is saved first, so you can restore it from
          Settings, under Your data.
        </DialogDescription>
        {error && (
          <p className="msg-bad" role="alert">
            Nothing was deleted, because the backup couldn't be saved. {error}
          </p>
        )}
        <DialogActions>
          <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => close(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger-solid" disabled={busy} onClick={() => void onDelete()}>
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {busy ? "Deleting…" : "Delete"}
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
