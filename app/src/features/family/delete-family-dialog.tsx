// "Delete Sarah's details?": the confirmation before a family is deleted, from
// the register or the family editor (docs/ui.md).
import { Trash2 } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { toast } from "../../hooks/use-toast";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import type { InvoiceTemplate } from "../../types";

interface Props {
  family: InvoiceTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs just before the family is deleted (the editor goes back to the register). */
  beforeDelete?: () => void;
}

export function DeleteFamilyDialog({ family, open, onOpenChange, beforeDelete }: Props) {
  const deleteTemplate = useAppStore((s) => s.deleteTemplate);

  const onDelete = () => {
    onOpenChange(false);
    if (!family) return;
    beforeDelete?.();
    deleteTemplate(family.id);
    toast({ title: "Deleted", description: `${family.recipient}'s details were removed.` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Delete {family?.recipient}'s details?</DialogTitle>
        <DialogDescription>
          This removes {family?.recipient} ({family?.students}) from the register. It can't be undone here, but your automatic backups keep a
          copy.
        </DialogDescription>
        <DialogActions>
          <DialogClose asChild>
            <button type="button" className="btn btn--secondary">
              Cancel
            </button>
          </DialogClose>
          <button type="button" className="btn btn--danger-solid" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Delete
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
