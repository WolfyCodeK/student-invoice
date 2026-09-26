// Settings → Gmail: the connection, plus the advanced "use my own Google OAuth
// client" override, which Rust keeps in Windows Credential Manager, never in
// app settings (docs/gmail.md). Both act straight away.
import { useState, type ReactNode } from "react";
import { CircleCheck, Loader2, Mail, MailX, Unlink } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { errorMessage, isBackendError } from "../../lib/backend";
import { useToast } from "../../hooks/use-toast";

export function GmailGroup() {
  const gmail = useAppStore((s) => s.gmail);
  const connecting = useAppStore((s) => s.gmailConnecting);
  const connectGmail = useAppStore((s) => s.connectGmail);
  const disconnectGmail = useAppStore((s) => s.disconnectGmail);
  const { toast } = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const onConnect = async () => {
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

  const onDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGmail();
      toast({ title: "Gmail disconnected", description: "Access has been removed from this PC." });
    } catch (error) {
      toast({ title: "Couldn't disconnect Gmail", description: errorMessage(error), variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  let status: ReactNode;
  if (!gmail) {
    status = (
      <span className="st-status" role="status">
        <Loader2 className="spin" aria-hidden="true" />
        Checking the connection…
      </span>
    );
  } else if (gmail.connected) {
    status = (
      <>
        <span className="ok st-wrap">
          <CircleCheck aria-hidden="true" />
          <span>
            Connected{gmail.email ? " as " : ""}
            {gmail.email && <strong>{gmail.email}</strong>}
          </span>
        </span>
        <button type="button" className="btn btn--secondary" onClick={onDisconnect} disabled={disconnecting}>
          {disconnecting ? <Loader2 className="spin" aria-hidden="true" /> : <Unlink aria-hidden="true" />}
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </>
    );
  } else if (!gmail.configured) {
    status = (
      <>
        <span className="st-status">
          <MailX aria-hidden="true" />
          Gmail isn't set up in this copy of the app.
        </span>
        <p className="shint">You can add your own Google OAuth client under Advanced, below.</p>
      </>
    );
  } else {
    status = (
      <>
        <span className="st-status">
          <MailX aria-hidden="true" />
          Not connected
        </span>
        <button type="button" className="btn btn--primary" onClick={onConnect} disabled={connecting}>
          {connecting ? <Loader2 className="spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
          {connecting ? "Connecting…" : "Connect Gmail"}
        </button>
        {connecting && <p className="shint">Finish signing in in the browser window that opened.</p>}
      </>
    );
  }

  return (
    <>
      <div className="srow">
        <div className="slab">
          <strong>Gmail account</strong>
          <span>Invoices are saved here as drafts. The app never sends email.</span>
        </div>
        <div className="sctl">{status}</div>
      </div>
      <CustomClient />
    </>
  );
}

function CustomClient() {
  const gmail = useAppStore((s) => s.gmail);
  const setCustomGmailClient = useAppStore((s) => s.setCustomGmailClient);
  const clearCustomGmailClient = useAppStore((s) => s.clearCustomGmailClient);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const custom = gmail?.clientSource === "custom";

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setClientId("");
      setClientSecret("");
      setMessage({ ok: true, text: success });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const incomplete = !clientId.trim() || !clientSecret.trim();

  return (
    <div className="st-block">
      <details className="adv">
        <summary>Advanced: use your own Google OAuth client</summary>
        <div className="st-adv">
          <p className="st-adv-note">
            {custom
              ? "This app is using your own OAuth client."
              : "Only needed if you run your own Google Cloud project. Changing it disconnects Gmail."}
          </p>
          <div className="st-field">
            <label htmlFor="gmail-client-id">Client ID</label>
            <input
              id="gmail-client-id"
              className="field"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="….apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="st-field">
            <label htmlFor="gmail-client-secret">Client secret</label>
            <input
              id="gmail-client-secret"
              type="password"
              className="field"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="sctl">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || incomplete}
              onClick={() => run(() => setCustomGmailClient(clientId, clientSecret), "Saved. Connect Gmail again to use it.")}
            >
              Use this client
            </button>
            {custom && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => run(() => clearCustomGmailClient(), "Switched back to the built-in client. Connect Gmail again.")}
              >
                Use the built-in client
              </button>
            )}
            {incomplete && !busy && <span className="shint">Fill in both boxes to use your own client.</span>}
          </div>
          <p className={message ? (message.ok ? "msg-ok" : "msg-bad") : undefined} role="status">
            {message?.text}
          </p>
        </div>
      </details>
    </div>
  );
}
