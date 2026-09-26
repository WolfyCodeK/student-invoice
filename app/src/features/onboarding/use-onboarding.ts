// After an update: "What's new" once, then (after the 1.1.0 update) the guided
// tour; and the tour on demand from Settings or the title bar's Help button.
// The rules are in whats-new.ts (decideOnboarding); docs/ui.md.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { decideOnboarding, type WhatsNewEntry } from "./whats-new";

export interface UseOnboardingOptions {
  /** True once the stored data has loaded and been upgraded. */
  ready: boolean;
  /** This build's version ("1.1.0"). Nothing is decided while it's empty. */
  currentVersion: string | null | undefined;
  /** Runs just before the tour opens (to switch to the register). */
  onBeforeTour?: () => void;
}

export interface Onboarding {
  whatsNewOpen: boolean;
  /** Oldest first. */
  whatsNewEntries: WhatsNewEntry[];
  /** The tour starts when "What's new" closes. */
  hasTourNext: boolean;
  closeWhatsNew: () => void;
  tourOpen: boolean;
  /** Shows the tour now (stable identity). */
  startTour: () => void;
  closeTour: () => void;
}

interface Flow {
  decided: boolean;
  entries: WhatsNewEntry[];
  whatsNewOpen: boolean;
  /** The tour is still to come in this flow. */
  tourNext: boolean;
  /** The version to record as seen once the flow finishes, if any. */
  seen: string | null;
}

const UNDECIDED: Flow = { decided: false, entries: [], whatsNewOpen: false, tourNext: false, seen: null };

export function useOnboarding({ ready, currentVersion, onBeforeTour }: UseOnboardingOptions): Onboarding {
  const lastSeenVersion = useAppStore((state) => state.settings.lastSeenVersion);
  const hasData = useAppStore((state) => state.templates.length > 0 || Boolean(state.settings.customEmailBodyTemplate));

  const [flow, setFlow] = useState<Flow>(UNDECIDED);
  const [tourOpen, setTourOpen] = useState(false);
  const frameRef = useRef(0);
  const markedRef = useRef<string | null>(null);
  const beforeTourRef = useRef(onBeforeTour);

  useLayoutEffect(() => {
    beforeTourRef.current = onBeforeTour;
  });

  // Decide once, as soon as the data and the version are known.
  if (!flow.decided && ready && currentVersion) {
    const decision = decideOnboarding({ lastSeenVersion, currentVersion, hasData });
    setFlow({
      decided: true,
      entries: decision.whatsNew,
      whatsNewOpen: decision.whatsNew.length > 0,
      tourNext: decision.tour,
      seen: decision.markSeen ? currentVersion : null,
    });
  }

  const startTour = useCallback(() => {
    beforeTourRef.current?.();
    // Open on the next frame, once the register is on screen.
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      setTourOpen(true);
      setFlow((current) => (current.tourNext ? { ...current, tourNext: false } : current));
    });
  }, []);

  const closeWhatsNew = useCallback(() => {
    setFlow((current) => (current.whatsNewOpen ? { ...current, whatsNewOpen: false } : current));
  }, []);

  const closeTour = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setTourOpen(false);
  }, []);

  // The tour follows "What's new" as soon as it closes.
  const tourDue = flow.decided && flow.tourNext && !flow.whatsNewOpen && !tourOpen;
  useEffect(() => {
    if (tourDue) startTour();
  }, [tourDue, startTour]);

  // Once nothing is showing or still to come, record this version as seen
  // (straight away when there was nothing to show).
  const finished = flow.decided && !flow.whatsNewOpen && !flow.tourNext && !tourOpen;
  useEffect(() => {
    if (!finished || !flow.seen || markedRef.current === flow.seen) return;
    markedRef.current = flow.seen;
    useAppStore.getState().markVersionSeen(flow.seen);
  }, [finished, flow.seen]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return {
    whatsNewOpen: flow.whatsNewOpen,
    whatsNewEntries: flow.entries,
    hasTourNext: flow.tourNext,
    closeWhatsNew,
    tourOpen,
    startTour,
    closeTour,
  };
}
