// Settings → Your data: move everything to another PC (export and import) and
// restore automatic backups. Acts straight away. See docs/backup.md.
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, FolderOpen, Loader2, RotateCcw, Upload } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { backend, errorMessage, type BackupInfo } from "../../lib/backend";
import { describeBackup } from "../../lib/backup";
import { parseBackup } from "../../lib/backup-parse";
import type { BackupFile } from "../../lib/schema";
import { toast } from "../../hooks/use-toast";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";

const REASON_LABELS: Record<BackupInfo["reason"], string> = {
  "pre-migration": "Before upgrading data",
  "pre-import": "Before an import",
  "pre-update": "Before an app update",
  "pre-restore": "Before a restore",
  "pre-delete": "Before deleting a family",
  daily: "Daily",
};

const SHOWN_AT_FIRST = 5;
const SHOWN_AT_MOST = 15;

const when = (d: Date) => format(d, "d MMM yyyy, HH:mm");

type Pending = { backup: BackupFile; source: "import" | "restore"; label: string };
type Busy = "export" | "import" | "folder" | "restore" | "replace" | null;

export function DataGroup() {
  const exportData = useAppStore((s) => s.exportData);
  const replaceAllData = useAppStore((s) => s.replaceAllData);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    backend.listBackups().then(
      (list) => {
        setBackups(list);
        setListError(null);
      },
      (e) => {
        setBackups([]);
        setListError(errorMessage(e));
      },
    );
  }, []);

  const guard = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onExport = () =>
    guard("export", async () => {
      const file = await exportData();
      if (file) toast({ title: "Data exported", description: `Saved as ${file}. Copy it to the other PC and use Import there.` });
    });

  const onImport = () =>
    guard("import", async () => {
      const text = await backend.importBackup();
      if (text === null) return; // cancelled
      const result = parseBackup(text);
      if (!result.ok) throw new Error(result.error);
      setPending({ backup: result.backup, source: "import", label: "this file" });
    });

  const onRestore = (b: BackupInfo) =>
    guard("restore", async () => {
      const result = parseBackup(await backend.readBackup(b.name));
      if (!result.ok) throw new Error(result.error);
      setPending({ backup: result.backup, source: "restore", label: `the backup from ${when(new Date(b.createdAt))}` });
    });

  const confirm = () =>
    guard("replace", async () => {
      if (!pending) return;
      await replaceAllData(pending.backup, pending.source === "import" ? "pre-import" : "pre-restore");
      // Reload so every part of the app (including the appearance) starts from the new data.
      window.location.reload();
    });

  const cancel = () => {
    setPending(null);
    setError(null);
  };

  const summary = pending ? describeBackup(pending.backup) : null;
  const list = backups ?? [];
  const shown = list.slice(0, showAll ? SHOWN_AT_MOST : SHOWN_AT_FIRST);
  const hidden = Math.min(list.length, SHOWN_AT_MOST) - shown.length;
  const spin = (kind: Busy) => busy === kind;

  return (
    <>
      <div className="srow">
        <div className="slab">
          <strong>Move to another PC</strong>
          <span>Export saves a file. Import it in Student Invoice on the other PC. Gmail isn't included, so connect it again there.</span>
        </div>
        <div className="sctl">
          <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={onExport}>
            {spin("export") ? <Loader2 className="spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Export data…
          </button>
          <button type="button" className="btn btn--secondary" disabled={busy !== null} onClick={onImport}>
            {spin("import") ? <Loader2 className="spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            Import data…
          </button>
        </div>
      </div>

      <div className="srow srow--top">
        <div className="slab">
          <strong id="st-backups">Automatic backups</strong>
          <span>Saved each day you use the app, and before an import, a restore, an update or deleting a family</span>
        </div>
        <div className="st-backups">
          {backups === null ? (
            <p className="st-status" role="status">
              <Loader2 className="spin" aria-hidden="true" />
              Looking for backups…
            </p>
          ) : listError ? (
            <p className="msg-bad" role="alert">
              The list of backups couldn't be read. {listError}
            </p>
          ) : list.length === 0 ? (
            <p className="st-empty">None yet. A backup is saved automatically each day you use the app, and before imports, updates and deletions.</p>
          ) : (
            <ul aria-labelledby="st-backups">
              {shown.map((b) => {
                const at = when(new Date(b.createdAt));
                return (
                  <li key={b.name} className="bk">
                    <p>
                      {at} <span>· {REASON_LABELS[b.reason]}</span>
                    </p>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={busy !== null}
                      onClick={() => onRestore(b)}
                      aria-label={`Restore the backup from ${at}`}
                    >
                      <RotateCcw aria-hidden="true" />
                      Restore
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="sctl st-backups-bar">
            {hidden > 0 && (
              <button type="button" className="btn btn--link" onClick={() => setShowAll(true)}>
                Show {hidden} older backup{hidden === 1 ? "" : "s"}
              </button>
            )}
            <button type="button" className="btn btn--ghost" disabled={busy !== null} onClick={() => guard("folder", () => backend.openBackupsFolder())}>
              <FolderOpen aria-hidden="true" />
              Open backups folder
            </button>
          </div>
        </div>
      </div>

      {error && !pending && (
        <p className="msg-bad st-error" role="alert">
          {error}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && busy === null && cancel()}>
        <DialogContent>
          <DialogTitle>Replace all your data?</DialogTitle>
          <DialogDescription>
            Your current families and settings will be replaced with {pending?.label}. A backup of what you have now is saved first, so you can
            undo this from Automatic backups.
          </DialogDescription>
          {summary && (
            <dl className="st-summary">
              <div>
                <dt>Families</dt>
                <dd className="num">{summary.templates}</dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd className="num">{when(summary.exportedAt)}</dd>
              </div>
              <div>
                <dt>By version</dt>
                <dd className="num">{summary.appVersion}</dd>
              </div>
            </dl>
          )}
          {error && pending && (
            <p className="msg-bad" role="alert">
              Nothing was replaced. {error}
            </p>
          )}
          <DialogActions>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy !== null}
              onClick={cancel}
            >
              Cancel
            </button>
            <button type="button" className="btn btn--danger-solid" disabled={busy !== null} onClick={confirm}>
              {spin("replace") && <Loader2 className="spin" aria-hidden="true" />}
              {spin("replace") ? "Replacing…" : "Replace everything"}
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
