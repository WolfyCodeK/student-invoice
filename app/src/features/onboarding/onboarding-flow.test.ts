import { describe, expect, it } from "vitest";
import { close, decide, isFinished, nextStep, show, UNDECIDED, type OnboardingFlow } from "./onboarding-flow";
import { decideOnboarding, type OnboardingInput } from "./whats-new";

const start = (input: OnboardingInput) => decide(UNDECIDED, decideOnboarding(input), input.currentVersion);
/** Opens whatever is next, as use-onboarding does once nothing is on screen. */
const openNext = (flow: OnboardingFlow) => {
  const step = nextStep(flow);
  if (!step) throw new Error("nothing to open");
  return show(flow, step);
};

describe("the steps after an update", () => {
  it("after the v1.1.0 update: What's new, then Choose how it looks, then the tour", () => {
    let flow = start({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true });
    expect(flow.showing).toBe("whats-new");
    expect(flow.queue).toEqual(["appearance", "tour"]);

    flow = close(flow, "whats-new");
    expect(nextStep(flow)).toBe("appearance");
    flow = openNext(flow);
    expect(flow.showing).toBe("appearance");
    expect(flow.queue).toEqual(["tour"]);

    flow = close(flow, "appearance");
    expect(nextStep(flow)).toBe("tour");
    flow = openNext(flow);
    expect(flow.showing).toBe("tour");

    flow = close(flow, "tour");
    expect(nextStep(flow)).toBeNull();
    expect(isFinished(flow)).toBe(true);
    expect(flow.seen).toBe("1.1.0");
  });

  it("updating from 1.0.x (no version recorded) runs the same three steps", () => {
    const flow = start({ currentVersion: "1.1.0", hasData: true });
    expect([flow.showing, ...flow.queue]).toEqual(["whats-new", "appearance", "tour"]);
  });

  it("records the version only at the end: not while any step is on screen or still to come", () => {
    let flow = start({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true });
    expect(isFinished(flow)).toBe(false);
    flow = close(flow, "whats-new");
    expect(isFinished(flow)).toBe(false); // the picker is about to open
    flow = openNext(flow);
    expect(isFinished(flow)).toBe(false); // the picker is open
    flow = close(flow, "appearance");
    expect(isFinished(flow)).toBe(false); // the tour is about to open
    flow = openNext(flow);
    expect(isFinished(flow)).toBe(false); // the tour is open
    expect(isFinished(close(flow, "tour"))).toBe(true);
  });

  it("later updates show What's new only: no picker, no tour", () => {
    let flow = start({ lastSeenVersion: "1.1.0", currentVersion: "1.2.0", hasData: true });
    expect(flow.queue).toEqual([]);
    flow = close(flow, "whats-new");
    expect(nextStep(flow)).toBeNull();
    expect(isFinished(flow)).toBe(true);
  });

  it("a fresh install shows nothing and is finished at once", () => {
    const flow = start({ currentVersion: "1.1.0", hasData: false });
    expect(flow.showing).toBeNull();
    expect(nextStep(flow)).toBeNull();
    expect(isFinished(flow)).toBe(true);
    expect(flow.seen).toBe("1.1.0");
  });

  it("the same version again shows nothing and records nothing", () => {
    const flow = start({ lastSeenVersion: "1.1.0", currentVersion: "1.1.0", hasData: true });
    expect(nextStep(flow)).toBeNull();
    expect(flow.seen).toBeNull();
  });
});

describe("the tour on demand (Help, Settings → Show the tour again)", () => {
  it("is the tour alone: the picker does not show before or after it", () => {
    let flow = start({ lastSeenVersion: "1.1.0", currentVersion: "1.1.0", hasData: true });
    flow = show(flow, "tour");
    expect(flow.queue).toEqual([]);
    flow = close(flow, "tour");
    expect(nextStep(flow)).toBeNull();
  });

  it("does not bring the picker back after the update's flow has finished", () => {
    let flow = start({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true });
    for (const step of ["whats-new", "appearance", "tour"] as const) {
      flow = close(flow, step);
      if (nextStep(flow)) flow = openNext(flow);
    }
    expect(isFinished(flow)).toBe(true);
    flow = close(show(flow, "tour"), "tour");
    expect(nextStep(flow)).toBeNull();
  });

  it("before the data has loaded, the flow decided later waits until the tour closes", () => {
    let flow = show(UNDECIDED, "tour");
    flow = decide(flow, decideOnboarding({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true }), "1.1.0");
    expect(flow.showing).toBe("tour");
    expect(nextStep(flow)).toBeNull();
    flow = close(flow, "tour");
    expect(nextStep(flow)).toBe("whats-new");
  });
});

describe("close", () => {
  it("does nothing for a step that isn't on screen", () => {
    const flow = start({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true });
    expect(close(flow, "appearance")).toBe(flow);
  });
});
