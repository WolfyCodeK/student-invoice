// Settings → About & help: version and updates, the guided tour, feedback.
import { CircleHelp, Download, MessageSquareText, RefreshCw } from "lucide-react";
import { useAppActions } from "../app-context";

export function AboutGroup() {
  const { appVersion, updates, checkForUpdates, startTour, openFeedback } = useAppActions();

  return (
    <>
      <div className="srow">
        <div className="slab">
          <strong>{appVersion ? `Student Invoice, version ${appVersion}` : "Student Invoice"}</strong>
          <span>Updates keep all your families and settings.</span>
        </div>
        <div className="sctl">
          {updates.available ? (
            <>
              <button type="button" className="btn btn--primary" onClick={checkForUpdates}>
                <Download aria-hidden="true" />
                Install the update…
              </button>
              <span className="st-new" role="status">
                Version {updates.version ?? "(newer)"} is ready to install
              </span>
            </>
          ) : (
            <button type="button" className="btn btn--secondary" onClick={checkForUpdates} disabled={updates.checking}>
              <RefreshCw className={updates.checking ? "spin" : undefined} aria-hidden="true" />
              {updates.checking ? "Checking…" : "Check for updates"}
            </button>
          )}
        </div>
      </div>
      <div className="srow">
        <div className="slab">
          <strong>Guided tour</strong>
          <span>A short walk through the register, one step at a time</span>
        </div>
        <div className="sctl">
          <button type="button" className="btn btn--secondary" onClick={startTour}>
            <CircleHelp aria-hidden="true" />
            Show the tour again
          </button>
        </div>
      </div>
      <div className="srow">
        <div className="slab">
          <strong>Feedback</strong>
          <span>Say what's working and what isn't, or report a problem</span>
        </div>
        <div className="sctl">
          <button type="button" className="btn btn--secondary" onClick={openFeedback}>
            <MessageSquareText aria-hidden="true" />
            Send feedback
          </button>
        </div>
      </div>
    </>
  );
}
