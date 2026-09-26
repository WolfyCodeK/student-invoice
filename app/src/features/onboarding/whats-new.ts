// "What's new" after an update, and whether the guided tour follows it
// (docs/ui.md). Pure: no React, no store. use-onboarding.ts wires it up.
//
// Rules for the wording: only changes a user would notice, never
// behind-the-scenes work, three to five very short lines per version.

/** Lucide icon names used by the news lines (whats-new-dialog.tsx draws them). */
export type NewsIcon = "layout-list" | "calendar-x" | "palette" | "hard-drive-download" | "mail-check";

export interface NewsItem {
  icon: NewsIcon;
  text: string;
}

export interface WhatsNewEntry {
  version: string;
  items: NewsItem[];
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: "1.1.0",
    items: [
      { icon: "layout-list", text: "A new look: all your families on one register." },
      { icon: "calendar-x", text: "Untick a lesson that didn't happen, and it comes off the bill." },
      { icon: "palette", text: "Choose colours, corners and light or dark in Settings." },
      { icon: "hard-drive-download", text: "Your data is backed up every day, and can move to another PC." },
      { icon: "mail-check", text: "Gmail stays connected, and connecting is simpler." },
    ],
  },
];

/** The update after which the guided tour runs once by itself. */
export const TOUR_VERSION = "1.1.0";

function versionParts(version: string): [number, number, number] {
  // "v1.2.3-beta+5" -> [1, 2, 3]. Missing or unreadable parts count as 0.
  const core = version.trim().replace(/^v/i, "").split(/[-+]/)[0];
  const [major, minor, patch] = core.split(".").map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

/** Compares "x.y.z" versions: negative if a is older, 0 if the same, positive if newer. */
export function compareVersions(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export interface OnboardingInput {
  /** settings.lastSeenVersion. v1.0.x never recorded it. */
  lastSeenVersion?: string;
  currentVersion: string;
  /** Any families or custom email wording: someone has used the app before. */
  hasData: boolean;
}

export interface OnboardingDecision {
  /** Entries to show, oldest first. Empty: don't show "What's new". */
  whatsNew: WhatsNewEntry[];
  /** Run the guided tour after "What's new". */
  tour: boolean;
  /** Record currentVersion as seen once the flow finishes (or at once if nothing shows). */
  markSeen: boolean;
}

function entriesBetween(catalogue: WhatsNewEntry[], after: string | null, upTo: string): WhatsNewEntry[] {
  return catalogue.filter(
    (entry) => (after === null || compareVersions(entry.version, after) > 0) && compareVersions(entry.version, upTo) <= 0,
  ).sort((a, b) => compareVersions(a.version, b.version));
}

function tourBetween(after: string | null, upTo: string): boolean {
  return (after === null || compareVersions(after, TOUR_VERSION) < 0) && compareVersions(TOUR_VERSION, upTo) <= 0;
}

/**
 * What to show the first time this version opens. `catalogue` is WHATS_NEW
 * (a parameter only so tests can use more than one version).
 */
export function decideOnboarding(
  { lastSeenVersion, currentVersion, hasData }: OnboardingInput,
  catalogue: WhatsNewEntry[] = WHATS_NEW,
): OnboardingDecision {
  const lastSeen = lastSeenVersion?.trim() ? lastSeenVersion : undefined;

  if (lastSeen === undefined) {
    // A fresh install has nothing new to show; an update from v1.0.x (which
    // never recorded a version) shows everything up to now.
    if (!hasData) return { whatsNew: [], tour: false, markSeen: true };
    return { whatsNew: entriesBetween(catalogue, null, currentVersion), tour: tourBetween(null, currentVersion), markSeen: true };
  }

  const order = compareVersions(lastSeen, currentVersion);
  // Already seen, or a downgrade: say nothing and keep the newer record.
  if (order >= 0) return { whatsNew: [], tour: false, markSeen: false };

  return { whatsNew: entriesBetween(catalogue, lastSeen, currentVersion), tour: tourBetween(lastSeen, currentVersion), markSeen: true };
}
