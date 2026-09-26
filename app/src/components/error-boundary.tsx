import { Component, type ErrorInfo, type ReactNode } from "react";
import { backend } from "../lib/backend";

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if rendering fails (for example because stored data
 * is damaged), show a way forward instead of a blank window. Data is never
 * touched here; automatic backups can be opened from this screen.
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
      <div className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
        <div className="max-w-lg space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Student Invoice hit an unexpected problem and couldn't show this screen. Your data has not been changed.
            Try reloading. If this keeps happening, your automatic backups are in the backups folder, and you can send
            feedback with the message below.
          </p>
          <pre className="text-xs whitespace-pre-wrap break-words rounded-md border p-3">{this.state.error.message}</pre>
          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void backend.openBackupsFolder().catch(() => {})}>
              Open backups folder
            </button>
          </div>
        </div>
      </div>
    );
  }
}
