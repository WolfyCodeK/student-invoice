// The order of the steps after an update (docs/ui.md "What's new and the
// tour"): What's new, then, when the tour runs by itself (the v1.1.0 update),
// "Choose how it looks" and the tour. Pure: use-onboarding.ts holds the state
// and opens each step; the tour on demand (Help, Settings) is the tour alone.
import type { OnboardingDecision, WhatsNewEntry } from "./whats-new";

export type OnboardingStep = "whats-new" | "appearance" | "tour";

export interface OnboardingFlow {
  decided: boolean;
  /** What's new, oldest first. */
  entries: WhatsNewEntry[];
  /** On screen now. */
  showing: OnboardingStep | null;
  /** Still to come after the update, in order. */
  queue: OnboardingStep[];
  /** The version to record as seen once the flow finishes, if any. */
  seen: string | null;
}

export const UNDECIDED: OnboardingFlow = { decided: false, entries: [], showing: null, queue: [], seen: null };

/** `step` is on screen now. If it was the next one to come, it no longer is. */
export function show(flow: OnboardingFlow, step: OnboardingStep): OnboardingFlow {
  return { ...flow, showing: step, queue: flow.queue[0] === step ? flow.queue.slice(1) : flow.queue };
}

/** `step` has closed (finished, skipped or dismissed). */
export function close(flow: OnboardingFlow, step: OnboardingStep): OnboardingFlow {
  return flow.showing === step ? { ...flow, showing: null } : flow;
}

/** The flow for this start-up. What's new shows straight away unless something is already on screen. */
export function decide(flow: OnboardingFlow, decision: OnboardingDecision, version: string): OnboardingFlow {
  const queue: OnboardingStep[] = [];
  if (decision.whatsNew.length > 0) queue.push("whats-new");
  // The appearance picker comes only with the tour that runs by itself.
  if (decision.tour) queue.push("appearance", "tour");
  const decided: OnboardingFlow = { decided: true, entries: decision.whatsNew, showing: flow.showing, queue, seen: decision.markSeen ? version : null };
  return decided.showing === null && queue[0] === "whats-new" ? show(decided, "whats-new") : decided;
}

/** The step to open next, once nothing is on screen. */
export function nextStep(flow: OnboardingFlow): OnboardingStep | null {
  return flow.decided && flow.showing === null ? (flow.queue[0] ?? null) : null;
}

/** Nothing on screen and nothing still to come: time to record the version as seen. */
export function isFinished(flow: OnboardingFlow): boolean {
  return flow.decided && flow.showing === null && flow.queue.length === 0;
}
