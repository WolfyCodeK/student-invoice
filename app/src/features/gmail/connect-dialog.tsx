// Shown while Google sign-in is open in the browser (docs/gmail.md).
import { Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";

export function GmailConnectDialog() {
  const { gmailConnecting, cancelGmailConnect } = useAppStore();
  return (
    <Dialog open={gmailConnecting} onOpenChange={(open) => !open && void cancelGmailConnect()}>
      <DialogContent>
        <DialogTitle>Connect Gmail</DialogTitle>
        <DialogDescription>Finish signing in in the browser window that just opened.</DialogDescription>
        <ol className="steps-list">
          <li>1. Choose the Google account to save drafts to.</li>
          <li>2. If Google says the app isn't verified, choose Advanced, then continue.</li>
          <li>3. Allow Student Invoice to manage drafts.</li>
        </ol>
        <DialogActions>
          <p className="dlg-wait">
            <Loader2 className="spin" /> Waiting for you to finish in the browser…
          </p>
          <button type="button" className="btn btn--secondary" onClick={() => void cancelGmailConnect()}>
            Cancel
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
