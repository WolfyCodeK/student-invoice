// The app's own title bar (the window has no Windows frame; docs/ui.md
// "Title bar"). Styled like part of the app, in the manner of Discord: a back
// arrow, where you are, the app's own buttons, then minimise / maximise /
// close. Empty areas drag the window; double-click maximises.
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, CircleHelp, Download, MessageSquareText, NotebookText, PencilLine, RefreshCw, Settings, UserPlus } from "lucide-react";
import appIcon from "../assets/app-icon.svg";
import { useAppActions } from "../features/app-context";
import { useAppStore } from "../stores/app-store";

export function TitleBar() {
  const { view, back, navigate, updates, checkForUpdates, startTour, openFeedback } = useAppActions();
  const templates = useAppStore((s) => s.templates);
  const [maximised, setMaximised] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const refresh = () => void win.isMaximized().then(setMaximised, () => {});
    refresh();
    void win.onResized(refresh).then((f) => (unlisten = f));
    return () => unlisten?.();
  }, []);

  // Where you are, in a word or two (the band below has the full heading).
  let icon = <NotebookText aria-hidden="true" />;
  let title = "Register";
  if (view.name === "settings") {
    icon = <Settings aria-hidden="true" />;
    title = "Register › Settings";
  } else if (view.name === "edit") {
    const t = templates.find((x) => x.id === view.templateId);
    icon = t ? <PencilLine aria-hidden="true" /> : <UserPlus aria-hidden="true" />;
    title = t ? `Register › ${t.recipient}` : "Register › New family";
  }

  const win = () => getCurrentWindow();

  return (
    <header className="tb" data-tauri-drag-region>
      <div className="tb-left" data-tauri-drag-region>
        {view.name !== "register" && (
          <button type="button" className="tb-btn" onClick={back} data-tip="Back to the register" data-tip-side="left" aria-label="Back to the register">
            <ArrowLeft />
          </button>
        )}
        <span className="tb-app" data-tauri-drag-region>
          <img src={appIcon} alt="" data-tauri-drag-region />
          <span data-tauri-drag-region>Student Invoice</span>
        </span>
      </div>

      <div className="tb-title" data-tauri-drag-region>
        {icon}
        <span data-tauri-drag-region>{title}</span>
      </div>

      <div className="tb-right" data-tauri-drag-region>
        <div className="tb-actions" data-tour="titlebar-actions">
          <button type="button" className="tb-btn" onClick={startTour} data-tip="Show the tour" aria-label="Show the tour">
            <CircleHelp />
          </button>
          {updates.available ? (
            <button type="button" className="tb-btn tb-btn--pill" onClick={checkForUpdates} data-tip={`Version ${updates.version ?? ""} is ready to install`}>
              <Download />
              Update ready
            </button>
          ) : (
            <button type="button" className="tb-btn" onClick={checkForUpdates} disabled={updates.checking} data-tip="Check for updates" aria-label="Check for updates">
              <RefreshCw className={updates.checking ? "spin" : undefined} />
            </button>
          )}
          <button type="button" className="tb-btn" onClick={openFeedback} data-tip="Send feedback" aria-label="Send feedback">
            <MessageSquareText />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => (view.name === "settings" ? back() : navigate({ name: "settings" }))}
            aria-pressed={view.name === "settings"}
            data-tip="Settings"
            aria-label="Settings"
          >
            <Settings />
          </button>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <div className="caps">
          <button type="button" className="cap" aria-label="Minimise" onClick={() => void win().minimize()}>
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
          </button>
          <button type="button" className="cap" aria-label={maximised ? "Restore" : "Maximise"} onClick={() => void win().toggleMaximize()}>
            {maximised ? (
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <rect x=".5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" aria-hidden="true"><rect x=".5" y=".5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
            )}
          </button>
          <button type="button" className="cap cap--close" aria-label="Close" onClick={() => void win().close()}>
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
