// The app shell: title bar, the current screen, and app-wide dialogs
// (docs/ui.md). Screens other than the register load on first use and are
// prefetched when idle (docs/performance.md).
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TitleBar } from "./components/title-bar";
import { Toaster } from "./components/toaster";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./components/ui/dialog";
import { ensureDailyBackup, migrateStoredData, takeStartupDataProblem } from "./stores/app-store";
import { errorMessage, getAppVersion } from "./lib/backend";
import { toast } from "./hooks/use-toast";
import { AppActionsContext, type AppActions, type View } from "./features/app-context";
import { RegisterView } from "./features/register/register-view";
import { GmailConnectDialog } from "./features/gmail/connect-dialog";
import { UpdateDialog } from "./features/updates/update-dialog";
import { useUpdates } from "./features/updates/use-updates";
import { useOnboarding } from "./features/onboarding/use-onboarding";

const loadSettings = () => import("./features/settings/settings-view");
const loadEditor = () => import("./features/family/family-editor");
const loadFeedback = () => import("./components/feedback-form");
const loadWhatsNew = () => import("./features/onboarding/whats-new-dialog");
const loadTour = () => import("./features/onboarding/tour");
const SettingsView = lazy(() => loadSettings().then((m) => ({ default: m.SettingsView })));
const FamilyEditor = lazy(() => loadEditor().then((m) => ({ default: m.FamilyEditor })));
const FeedbackForm = lazy(() => loadFeedback().then((m) => ({ default: m.FeedbackForm })));
const WhatsNewDialog = lazy(() => loadWhatsNew().then((m) => ({ default: m.WhatsNewDialog })));
const Tour = lazy(() => loadTour().then((m) => ({ default: m.Tour })));

export default function App() {
  const [view, setView] = useState<View>({ name: "register" });
  const [appVersion, setAppVersion] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Checked quietly at start; the title bar then shows "Update ready".
  const { info: update, checking, dialogOpen: updateOpen, closeDialog: closeUpdate, check: checkForUpdates } = useUpdates();
  // Screens with unsaved changes (the family editor, the email wording) register a check here.
  const leaveGuards = useRef(new Set<() => boolean>());
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  // Warm up the screens that load on demand once the app is idle.
  useEffect(() => {
    const id = window.requestIdleCallback(() => {
      void loadSettings();
      void loadEditor();
      void loadFeedback();
    });
    return () => window.cancelIdleCallback(id);
  }, []);

  // Upgrade data from older versions (backed up first), then take the daily
  // automatic backup (docs/data-model.md, docs/backup.md).
  useEffect(() => {
    // Stored data that couldn't be read was set aside as the store loaded: say so, once.
    const problem = takeStartupDataProblem();
    if (problem) {
      toast({
        title: "Your saved data couldn't be read",
        description:
          problem === "kept"
            ? "The app has started empty, and a copy of the unreadable data was kept. To get your families back, restore an automatic backup in Settings, under Your data."
            : "It was left as it was, so changes you make now won't be saved. To get your families back, restore an automatic backup in Settings, under Your data.",
        variant: "destructive",
        duration: Infinity,
      });
    }
    migrateStoredData()
      .catch((error) => console.warn("Data upgrade postponed:", errorMessage(error)))
      .finally(() => setDataReady(true))
      .then(ensureDailyBackup)
      .catch((error) => console.warn("Daily backup failed:", errorMessage(error)));
  }, []);

  useEffect(() => {
    void getAppVersion().then(setAppVersion);
  }, []);

  // What's new once after each update, then (after 1.1.0) the tour.
  const onboarding = useOnboarding({
    ready: dataReady && appVersion !== "" && appVersion !== "unknown",
    currentVersion: appVersion,
    onBeforeTour: () => setView({ name: "register" }),
  });

  const registerLeaveGuard = useCallback((hasUnsavedChanges: () => boolean) => {
    const guards = leaveGuards.current;
    guards.add(hasUnsavedChanges);
    return () => {
      guards.delete(hasUnsavedChanges);
    };
  }, []);

  /** Leaves the current screen now, or after "Discard your changes?" if it has unsaved changes. */
  const leave = useCallback((go: () => void) => {
    if ([...leaveGuards.current].some((unsaved) => unsaved())) setPendingLeave(() => go);
    else go();
  }, []);

  const discardAndLeave = () => {
    const go = pendingLeave;
    setPendingLeave(null);
    go?.();
  };

  const actions = useMemo<AppActions>(
    () => ({
      view,
      navigate: (next) => leave(() => setView(next)),
      back: () => leave(() => setView({ name: "register" })),
      appVersion,
      updates: { checking, available: update?.available ?? false, version: update?.version ?? null },
      checkForUpdates: () => void checkForUpdates(),
      startTour: () => leave(onboarding.startTour),
      openFeedback: () => setFeedbackOpen(true),
      registerLeaveGuard,
    }),
    [view, appVersion, checking, update, checkForUpdates, onboarding.startTour, leave, registerLeaveGuard],
  );

  return (
    <AppActionsContext.Provider value={actions}>
      <div className="app">
        <TitleBar />
        <main className="view">
          {view.name === "register" ? (
            <RegisterView />
          ) : (
            // The band keeps the title bar's colour while a screen loads (normally instant: they're prefetched).
            <Suspense fallback={<header className="band" aria-busy="true" />}>
              {view.name === "settings" ? <SettingsView /> : <FamilyEditor key={view.templateId ?? "new"} />}
            </Suspense>
          )}
        </main>
      </div>

      <GmailConnectDialog />
      <UpdateDialog info={update} open={updateOpen} onClose={closeUpdate} />
      <Dialog open={pendingLeave !== null} onOpenChange={(open) => !open && setPendingLeave(null)}>
        <DialogContent>
          <DialogTitle>Discard your changes?</DialogTitle>
          <DialogDescription>You've made changes that aren't saved. If you leave now, they'll be lost.</DialogDescription>
          <DialogActions>
            <DialogClose asChild>
              <button type="button" className="btn btn--secondary">
                Keep editing
              </button>
            </DialogClose>
            <button type="button" className="btn btn--danger-solid" onClick={discardAndLeave}>
              Discard
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Found a problem, or want something to work differently? It goes straight to the developer.</DialogDescription>
          <Suspense fallback={null}>
            <FeedbackForm onClose={() => setFeedbackOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>
      {(onboarding.whatsNewOpen || onboarding.tourOpen) && (
        <Suspense fallback={null}>
          <WhatsNewDialog open={onboarding.whatsNewOpen} entries={onboarding.whatsNewEntries} hasTourNext={onboarding.hasTourNext} onClose={onboarding.closeWhatsNew} />
          <Tour open={onboarding.tourOpen} onClose={onboarding.closeTour} />
        </Suspense>
      )}

      <Toaster />
    </AppActionsContext.Provider>
  );
}
