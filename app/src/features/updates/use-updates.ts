// Checking for updates (docs/architecture.md "Updates"): quietly at start, so
// the Updates button can show a dot and a notice can say so once, and on
// demand, which opens the update dialog or says the app is up to date. An
// update the release marks as important (below its minimum supported version)
// opens the dialog at every start instead; "Not now" still works
// (docs/decisions/0002-no-forced-updates.md).
import { useCallback, useEffect, useState } from "react";
import { backend, errorMessage, type UpdateInfo } from "../../lib/backend";
import { toast } from "../../hooks/use-toast";

export interface Updates {
  /** The last check's result. */
  info: UpdateInfo | null;
  checking: boolean;
  /** The update dialog is open (only ever with an update available). */
  dialogOpen: boolean;
  /** The dialog was opened to install straight away (from the start-up notice). */
  installing: boolean;
  closeDialog: () => void;
  /** Opens the dialog and starts installing (stable identity). */
  install: () => void;
  /** An update found at start-up that hasn't been announced yet (none once the dialog has been opened). */
  toAnnounce: UpdateInfo | null;
  /** Records that it has been announced, or doesn't need to be (stable identity). */
  announced: () => void;
  /** Checks now (stable identity). */
  check: () => Promise<void>;
}

export function useUpdates(): Updates {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [toAnnounce, setToAnnounce] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    backend.checkForUpdates().then(
      (result) => {
        setInfo(result);
        if (result.available && result.required) setDialogOpen(true);
        else if (result.available) setToAnnounce(result);
      },
      (error) => console.warn("Update check failed:", errorMessage(error)),
    );
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setToAnnounce(null);
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

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setInstalling(false);
  }, []);

  const install = useCallback(() => {
    setToAnnounce(null);
    setInstalling(true);
    setDialogOpen(true);
  }, []);

  const announced = useCallback(() => setToAnnounce(null), []);

  return { info, checking, dialogOpen, installing, closeDialog, install, toAnnounce, announced, check };
}
