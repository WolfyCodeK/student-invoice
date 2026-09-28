// "An update is ready": install with download progress (docs/release.md).
// Can't be closed while installing; the installer then restarts the app.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Download, Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { errorMessage, type UpdateInfo, type UpdateProgress } from "../../lib/backend";
import { toast } from "../../hooks/use-toast";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";

interface Props {
  /** The update found. The dialog is only opened when one is available. */
  info: UpdateInfo | null;
  open: boolean;
  /** Start installing as soon as it opens ("Install update" on the start-up notice). */
  installNow?: boolean;
  onClose: () => void;
}

export function UpdateDialog({ info, open, installNow = false, onClose }: Props) {
  const installUpdate = useAppStore((s) => s.installUpdate);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  // Download progress while an update installs.
  useEffect(() => {
    const unlisten = listen<UpdateProgress>("update://progress", (e) => setProgress(e.payload));
    return () => void unlisten.then((f) => f());
  }, []);

  const onInstall = useCallback(async () => {
    setInstalling(true);
    setProgress(null);
    try {
      // On success the installer takes over and the app closes.
      await installUpdate();
    } catch (error) {
      toast({ title: "The update didn't install", description: errorMessage(error), variant: "destructive" });
      setInstalling(false);
      onClose();
    }
  }, [installUpdate, onClose]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (!open) startedRef.current = false;
    else if (installNow && !startedRef.current) {
      startedRef.current = true;
      void onInstall();
    }
  }, [open, installNow, onInstall]);

  const percent = progress?.total ? Math.round((progress.downloaded / progress.total) * 100) : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !installing && onClose()}>
      <DialogContent onEscapeKeyDown={(e) => installing && e.preventDefault()} onPointerDownOutside={(e) => installing && e.preventDefault()}>
        <DialogTitle>{`Version ${info?.version} is ready`}</DialogTitle>
        <DialogDescription>Installing takes a minute. Your families, settings and backups stay exactly as they are.</DialogDescription>
        {info?.required && (
          <p className="update-important">
            <strong>This is an important update.</strong> Please install it now.
          </p>
        )}
        {info?.notes && <p className="update-notes">{info.notes}</p>}
        {installing && (
          <div className="update-progress" role="status">
            <div className="update-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${(percent ?? 8) / 100})` }} />
            </div>
            <p>
              {percent !== null ? `Downloading… ${percent}%` : "Downloading…"} The app will close and reopen when it's done.
            </p>
          </div>
        )}
        <DialogActions>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={installing}>
            Not now
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void onInstall()} disabled={installing}>
            {installing ? <Loader2 className="spin" /> : <Download />} {installing ? "Installing…" : "Install update"}
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
