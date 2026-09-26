// "An update is ready": install with download progress (docs/release.md).
// Can't be closed while installing; the installer then restarts the app.
import { Download, Loader2 } from "lucide-react";
import type { UpdateInfo } from "../../lib/backend";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";

interface Props {
  info: UpdateInfo | null;
  open: boolean;
  installing: boolean;
  progress: { downloaded: number; total: number | null } | null;
  onClose: () => void;
  onInstall: () => void;
}

export function UpdateDialog({ info, open, installing, progress, onClose, onInstall }: Props) {
  const percent = progress?.total ? Math.round((progress.downloaded / progress.total) * 100) : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !installing && onClose()}>
      <DialogContent onEscapeKeyDown={(e) => installing && e.preventDefault()} onPointerDownOutside={(e) => installing && e.preventDefault()}>
        <DialogTitle>{info?.available ? `Version ${info.version} is ready` : "You're up to date"}</DialogTitle>
        <DialogDescription>
          {info?.available
            ? "Installing takes a minute. Your families, settings and backups stay exactly as they are."
            : `You're running version ${info?.currentVersion ?? ""}.`}
        </DialogDescription>
        {info?.available && info.notes && <p className="update-notes">{info.notes}</p>}
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
            {info?.available ? "Not now" : "Close"}
          </button>
          {info?.available && (
            <button type="button" className="btn btn--primary" onClick={onInstall} disabled={installing}>
              {installing ? <Loader2 className="spin" /> : <Download />} {installing ? "Installing…" : "Install update"}
            </button>
          )}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
