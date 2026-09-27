// After an update: "What's new" once, then (after the 1.1.0 update) "Choose how
// it looks" and the guided tour; and the tour on demand from Settings or the
// title bar's Help button. The rules are in whats-new.ts (decideOnboarding),
// the order in onboarding-flow.ts; docs/ui.md.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { decideOnboarding, type WhatsNewEntry } from "./whats-new";
import { close, decide, isFinished, nextStep, show, UNDECIDED, type OnboardingFlow, type OnboardingStep } from "./onboarding-flow";

export interface UseOnboardingOptions {
  /** True once the stored data has loaded and been upgraded. */
  ready: boolean;
  /** This build's version ("1.1.0"). Nothing is decided while it's empty. */
  currentVersion: string | null | undefined;
  /** Switches to the register. Runs just before the appearance picker or the tour opens. */
  showRegister?: () => void;
}

export interface Onboarding {
  whatsNewOpen: boolean;
  /** Oldest first. */
  whatsNewEntries: WhatsNewEntry[];
  /** The step that follows the one on screen, if any. */
  next: OnboardingStep | null;
  closeWhatsNew: () => void;
  appearanceOpen: boolean;
  closeAppearance: () => void;
  tourOpen: boolean;
  /** Shows the tour now (stable identity). */
  startTour: () => void;
  closeTour: () => void;
}

export function useOnboarding({ ready, currentVersion, showRegister }: UseOnboardingOptions): Onboarding {
  const lastSeenVersion = useAppStore((state) => state.settings.lastSeenVersion);
  const hasData = useAppStore((state) => state.templates.length > 0 || Boolean(state.settings.customEmailBodyTemplate));

  const [flow, setFlow] = useState<OnboardingFlow>(UNDECIDED);
  const frameRef = useRef(0);
  const markedRef = useRef<string | null>(null);
  const showRegisterRef = useRef(showRegister);

  useLayoutEffect(() => {
    showRegisterRef.current = showRegister;
  });

  // Decide once, as soon as the data and the version are known.
  if (!flow.decided && ready && currentVersion) {
    setFlow(decide(flow, decideOnboarding({ lastSeenVersion, currentVersion, hasData }), currentVersion));
  }

  /** Opens a step on the next frame; the picker and the tour switch to the register first. */
  const open = useCallback((step: OnboardingStep) => {
    if (step !== "whats-new") showRegisterRef.current?.();
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      setFlow((current) => show(current, step));
    });
  }, []);

  const startTour = useCallback(() => open("tour"), [open]);

  const closeWhatsNew = useCallback(() => setFlow((current) => close(current, "whats-new")), []);
  const closeAppearance = useCallback(() => setFlow((current) => close(current, "appearance")), []);
  const closeTour = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setFlow((current) => close(current, "tour"));
  }, []);

  // Each step follows the one before as soon as it closes.
  const due = nextStep(flow);
  useEffect(() => {
    if (due) open(due);
  }, [due, open]);

  // Once nothing is showing or still to come, record this version as seen
  // (straight away when there was nothing to show).
  const finished = isFinished(flow);
  useEffect(() => {
    if (!finished || !flow.seen || markedRef.current === flow.seen) return;
    markedRef.current = flow.seen;
    useAppStore.getState().markVersionSeen(flow.seen);
  }, [finished, flow.seen]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return {
    whatsNewOpen: flow.showing === "whats-new",
    whatsNewEntries: flow.entries,
    next: flow.queue[0] ?? null,
    closeWhatsNew,
    appearanceOpen: flow.showing === "appearance",
    closeAppearance,
    tourOpen: flow.showing === "tour",
    startTour,
    closeTour,
  };
}
