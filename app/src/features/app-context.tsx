// App-wide navigation and actions shared by every screen (docs/ui.md).
// App.tsx provides it; screens read it with useAppActions().
import { createContext, useContext } from "react";

export type SettingsSection = "appearance" | "gmail" | "wording" | "terms" | "data" | "performance" | "about";

export type View =
  | { name: "register" }
  | { name: "settings"; section?: SettingsSection }
  | { name: "edit"; templateId: string | null };

export interface UpdateState {
  checking: boolean;
  available: boolean;
  version: string | null;
}

export interface AppActions {
  view: View;
  navigate: (view: View) => void;
  /** Back to the register (the only screen others return to). */
  back: () => void;
  appVersion: string;
  updates: UpdateState;
  /** Checks now; opens the update dialog if one is available, else says "up to date". */
  checkForUpdates: () => void;
  startTour: () => void;
  openFeedback: () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext);
  if (!actions) throw new Error("useAppActions must be used inside AppActionsContext");
  return actions;
}
