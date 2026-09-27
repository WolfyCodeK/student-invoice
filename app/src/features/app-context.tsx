// App-wide navigation and actions shared by every screen (docs/ui.md).
// App.tsx provides it; screens read it with useAppActions().
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

export type View = { name: "register" } | { name: "settings" } | { name: "edit"; templateId: string | null };

export interface UpdateState {
  checking: boolean;
  available: boolean;
  version: string | null;
}

export interface AppActions {
  view: View;
  /** Asks "Discard your changes?" first if the screen has unsaved changes (useLeaveGuard). */
  navigate: (view: View) => void;
  /** Back to the register (the only screen others return to). Asks first, like `navigate`. */
  back: () => void;
  appVersion: string;
  updates: UpdateState;
  /** Checks now; opens the update dialog if one is available, else says "up to date". */
  checkForUpdates: () => void;
  /** Goes to the register for the tour. Asks first, like `navigate`. */
  startTour: () => void;
  openFeedback: () => void;
  /** Adds a check for unsaved changes; returns the function that removes it. */
  registerLeaveGuard: (hasUnsavedChanges: () => boolean) => () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext);
  if (!actions) throw new Error("useAppActions must be used inside AppActionsContext");
  return actions;
}

/**
 * While `unsaved` is true, leaving this screen (Back, Settings, Help) asks
 * "Discard your changes?" first. Returns a function to call just before
 * leaving on purpose (after saving, or Cancel), so that leaving doesn't ask.
 */
export function useLeaveGuard(unsaved: boolean): () => void {
  const { registerLeaveGuard } = useAppActions();
  const leaving = useRef(false);
  useEffect(() => {
    if (!unsaved) return;
    return registerLeaveGuard(() => !leaving.current);
  }, [unsaved, registerLeaveGuard]);
  return useCallback(() => {
    leaving.current = true;
  }, []);
}
