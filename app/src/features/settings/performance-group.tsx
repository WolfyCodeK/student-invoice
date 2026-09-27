// Settings → Performance: Low memory mode (WebView2 without GPU rendering).
// Saved straight away; applies after a restart. See docs/performance.md.
import { useEffect, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { backend, errorMessage } from "../../lib/backend";

export function PerformanceGroup() {
  // The saved choice (used from the next start), and what this window was
  // started with, as Rust reports them: reopening Settings can't lose a pending restart.
  const [saved, setSaved] = useState<boolean | null>(null);
  const [active, setActive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    backend.getPreferences().then(
      (p) => {
        setSaved(p.lowMemoryMode);
        setActive(p.lowMemoryModeActive);
      },
      (e) => setError(`The setting couldn't be read. ${errorMessage(e)}`),
    );
  }, []);

  const toggle = async (enabled: boolean) => {
    setError(null);
    setSaving(true);
    try {
      const p = await backend.setLowMemoryMode(enabled);
      setSaved(p.lowMemoryMode);
      setActive(p.lowMemoryModeActive);
    } catch (e) {
      setError(`The change wasn't saved. ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const restart = async () => {
    setError(null);
    setRestarting(true);
    try {
      await backend.restartApp();
    } catch (e) {
      setError(`Student Invoice couldn't restart itself. Close it and open it again. ${errorMessage(e)}`);
      setRestarting(false);
    }
  };

  const needsRestart = saved !== null && active !== null && saved !== active;
  const state = active === null ? (error ? "Unavailable" : "Checking…") : active ? "On" : "Off";

  return (
    <div className="srow srow--top">
      <div className="slab">
        <label htmlFor="low-memory-mode">
          <strong>Low memory mode</strong>
        </label>
        <span>Currently {state.toLowerCase()}</span>
      </div>
      <div className="sctl st-perf">
        <Switch
          id="low-memory-mode"
          checked={saved ?? false}
          disabled={saved === null || saving}
          onCheckedChange={toggle}
          aria-describedby="low-memory-note"
        />
        <p id="low-memory-note" className="st-perf-note">
          Uses about 40% less memory by not using the graphics card. Scrolling may be a little less smooth on high-resolution screens. Applies
          after a restart.
        </p>
        {needsRestart && (
          <div className="st-restart" role="status">
            <span>Restart Student Invoice to apply this.</span>
            <button type="button" className="btn btn--primary btn--sm" onClick={restart} disabled={restarting}>
              {restarting ? <Loader2 className="spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
              {restarting ? "Restarting…" : "Restart now"}
            </button>
          </div>
        )}
        {error && (
          <p className="msg-bad st-full" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
