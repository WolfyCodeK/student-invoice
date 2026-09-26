import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { backend, errorMessage } from "../lib/backend";

/**
 * Settings → Performance: "Low memory mode" (WebView2 without GPU rendering).
 * Saved immediately; applies after a restart. See docs/performance.md.
 */
export function PerformanceSection() {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [atStartup, setAtStartup] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend.getPreferences().then(
      (p) => {
        setSaved(p.lowMemoryMode);
        setAtStartup(p.lowMemoryMode);
      },
      (e) => setError(errorMessage(e)),
    );
  }, []);

  const toggle = async (enabled: boolean) => {
    setError(null);
    try {
      setSaved((await backend.setLowMemoryMode(enabled)).lowMemoryMode);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const needsRestart = saved !== null && atStartup !== null && saved !== atStartup;

  return (
    <div className="space-y-4 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
          <Gauge className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <h3 className="text-lg font-semibold text-sky-800 dark:text-sky-200">Performance</h3>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="low-memory-mode">Low memory mode</Label>
          <p className="text-sm text-muted-foreground">
            Uses about 40% less memory by not using the graphics card. Scrolling may be a little less smooth on
            high-resolution screens.
          </p>
        </div>
        <Switch id="low-memory-mode" checked={saved ?? false} disabled={saved === null} onCheckedChange={toggle} />
      </div>
      {needsRestart && (
        <div className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
          <span>Restart Student Invoice to apply this.</span>
          <Button size="sm" onClick={() => void backend.restartApp()}>
            Restart now
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
