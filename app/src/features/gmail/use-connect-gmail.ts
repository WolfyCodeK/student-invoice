// Connecting Gmail, from the register or Settings (docs/gmail.md): sign-in
// happens in the browser while connect-dialog.tsx waits, then a toast says
// how it went. Cancelling says nothing.
import { useAppStore } from "../../stores/app-store";
import { errorMessage, isBackendError } from "../../lib/backend";
import { toast } from "../../hooks/use-toast";

export function useConnectGmail(): () => Promise<void> {
  const connectGmail = useAppStore((s) => s.connectGmail);
  return async () => {
    try {
      const status = await connectGmail();
      toast({
        title: "Gmail connected",
        description: status.email ? `Drafts will be saved to ${status.email}.` : "Drafts will be saved to your Gmail account.",
      });
    } catch (error) {
      if (isBackendError(error) && error.kind === "Cancelled") return;
      toast({ title: "Gmail wasn't connected", description: errorMessage(error), variant: "destructive" });
    }
  };
}
