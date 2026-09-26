import { Component, type ErrorInfo, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { backend } from "../lib/backend";

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if rendering fails (for example because stored data
 * is damaged), show a way forward instead of a blank window. Data is never
 * touched here; automatic backups can be opened from this screen. The window
 * has no Windows frame, so this screen draws its own bar with Close.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <header className="tb" data-tauri-drag-region>
          <span className="tb-app" data-tauri-drag-region>
            Student Invoice
          </span>
          <span data-tauri-drag-region />
          <div className="caps" style={{ justifySelf: "end" }}>
            <button type="button" className="cap cap--close" aria-label="Close" onClick={() => void getCurrentWindow().close()}>
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
            </button>
          </div>
        </header>
        <main className="view" style={{ display: "grid", placeItems: "center", padding: 32, background: "var(--page)" }}>
          <div style={{ maxWidth: 560, display: "grid", gap: 16 }}>
            <h1 style={{ fontSize: "var(--fs-xl)" }}>Something went wrong</h1>
            <p style={{ fontSize: "var(--fs-m)" }}>
              Student Invoice hit an unexpected problem and couldn't show this screen. Your data has not been changed. Try
              reloading. If it keeps happening, your automatic backups are in the backups folder, and you can send the
              message below to the developer.
            </p>
            <pre className="field" style={{ height: "auto", padding: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "var(--fs-xs)" }}>
              {this.state.error.message}
            </pre>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => void backend.openBackupsFolder().catch(() => {})}>
                Open backups folder
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}
