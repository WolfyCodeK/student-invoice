import { useCallback, useEffect, useState } from "react";
import { Archive, Download, FolderOpen, RotateCcw, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { useAppStore } from "../stores/app-store";
import { backend, errorMessage, type BackupInfo } from "../lib/backend";
import { describeBackup, parseBackup } from "../lib/backup";
import type { BackupFile } from "../lib/schema";
import { useToast } from "../hooks/use-toast";

const REASON_LABELS: Record<BackupInfo["reason"], string> = {
  "pre-migration": "Before upgrading data",
  "pre-import": "Before an import",
  "pre-update": "Before an app update",
  "pre-restore": "Before a restore",
  daily: "Daily",
};

const formatDate = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Pending = { backup: BackupFile; source: "import" | "restore"; label: string };

/**
 * Settings → "Your data": move everything to another PC (export/import) and
 * restore automatic backups. Acts immediately, independent of the Settings
 * dialog's Save button. See docs/backup.md.
 */
export function DataSection() {
  const { exportData, pickImportFile, replaceAllData } = useAppStore();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = useCallback(() => {
    backend.listBackups().then(setBackups, () => setBackups([]));
  }, []);
  useEffect(refresh, [refresh]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onExport = () =>
    guard(async () => {
      const file = await exportData();
      if (file) toast({ title: "Data exported", description: `Saved as ${file}. Copy it to the other PC and use Import there.` });
    });

  const onImport = () =>
    guard(async () => {
      const result = await pickImportFile();
      if (!result) return;
      if (!result.ok) throw new Error(result.error);
      setPending({ backup: result.backup, source: "import", label: "this file" });
    });

  const onRestore = (b: BackupInfo) =>
    guard(async () => {
      const result = parseBackup(await backend.readBackup(b.name));
      if (!result.ok) throw new Error(result.error);
      setPending({ backup: result.backup, source: "restore", label: `the backup from ${formatDate(new Date(b.createdAt))}` });
    });

  const confirm = () =>
    guard(async () => {
      if (!pending) return;
      await replaceAllData(pending.backup, pending.source === "import" ? "pre-import" : "pre-restore");
      // Reload so every part of the app (including the theme) starts from the new data.
      window.location.reload();
    });

  const summary = pending ? describeBackup(pending.backup) : null;

  return (
    <div className="space-y-4 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
          <Archive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Your data</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Move your templates and settings to another PC: export here, then import the file in Student Invoice on the
        other PC. Gmail isn't included, so connect it again there.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onExport}>
          <Download className="h-4 w-4 mr-1" /> Export data…
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={onImport}>
          <Upload className="h-4 w-4 mr-1" /> Import data…
        </Button>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Automatic backups</h4>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => guard(() => backend.openBackupsFolder())}>
            <FolderOpen className="h-4 w-4 mr-1" /> Open folder
          </Button>
        </div>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. A backup is saved automatically each day you use the app, and before imports and updates.
          </p>
        ) : (
          <ul className="max-h-48 overflow-y-auto divide-y rounded-md border text-sm">
            {backups.slice(0, 15).map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {formatDate(new Date(b.createdAt))}
                  <span className="text-muted-foreground"> · {REASON_LABELS[b.reason]}</span>
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onRestore(b)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace all your data?</DialogTitle>
            <DialogDescription>
              Your current templates and settings will be replaced with {pending?.label}. A backup of what you have now is
              saved first, so you can undo this from Automatic backups.
            </DialogDescription>
          </DialogHeader>
          {summary && (
            <ul className="text-sm space-y-1">
              <li>
                <strong>{summary.templates}</strong> template{summary.templates === 1 ? "" : "s"}
              </li>
              <li>Saved {formatDate(summary.exportedAt)} by version {summary.appVersion}</li>
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirm}>
              Replace everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
