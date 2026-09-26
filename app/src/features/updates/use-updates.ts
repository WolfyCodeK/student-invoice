// Checking for updates (docs/architecture.md "Updates"): quietly at start, so
// the title bar can show "Update ready", and on demand, which opens the update
// dialog or says the app is up to date. An update the release marks as
// important (below its minimum supported version) opens the dialog at every
// start; "Not now" still works (docs/decisions/0002-no-forced-updates.md).
import { useCallback, useEffect, useState } from "react";
import { backend, errorMessage, type UpdateInfo } from "../../lib/backend";
import { toast } from "../../hooks/use-toast";

export interface Updates {
  /** The last check's result. */
  info: UpdateInfo | null;
  checking: boolean;
  /** The update dialog is open (only ever with an update available). */
  dialogOpen: boolean;
  closeDialog: () => void;
  /** Checks now (stable identity). */
  check: () => Promise<void>;
}

export function useUpdates(): Updates {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    backend.checkForUpdates().then(
      (result) => {
        setInfo(result);
        if (result.available && result.required) setDialogOpen(true);
      },
      (error) => console.warn("Update check failed:", errorMessage(error)),
    );
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = await backend.checkForUpdates();
      setInfo(result);
      if (result.available) setDialogOpen(true);
      else toast({ title: result.disabledInDev ? "Updates are off in development builds" : "You're up to date", description: `Version ${result.currentVersion}.` });
    } catch (error) {
      toast({ title: "Couldn't check for updates", description: errorMessage(error), variant: "destructive" });
    } finally {
      setChecking(false);
    }
  }, []);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  return { info, checking, dialogOpen, closeDialog, check };
}
