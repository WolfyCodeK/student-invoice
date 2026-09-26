// The app shell: title bar, the current screen, and app-wide dialogs
// (docs/ui.md). Screens other than the register load on first use and are
// prefetched when idle (docs/performance.md).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { TitleBar } from "./components/title-bar";
import { Toaster } from "./components/toaster";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./components/ui/dialog";
import { ensureDailyBackup, migrateStoredData } from "./stores/app-store";
import { errorMessage, getAppVersion } from "./lib/backend";
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

  const actions = useMemo<AppActions>(
    () => ({
      view,
      navigate: setView,
      back: () => setView({ name: "register" }),
      appVersion,
      updates: { checking, available: update?.available ?? false, version: update?.version ?? null },
      checkForUpdates: () => void checkForUpdates(),
      startTour: onboarding.startTour,
      openFeedback: () => setFeedbackOpen(true),
    }),
    [view, appVersion, checking, update, checkForUpdates, onboarding.startTour],
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
