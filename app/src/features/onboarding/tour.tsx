// The guided tour (docs/ui.md): one area at a time is highlighted and the rest
// of the window dimmed, with a text box saying how to use it. Steps and their
// order are in tour-steps.ts; placement is in tour-layout.ts.
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { layoutTour, type Box } from "./tour-layout";
import { TOUR_STEPS, type TourStep, type TourTarget } from "./tour-steps";
import "./tour.css";

export interface TourProps {
  open: boolean;
  /** Finished or skipped. */
  onClose: () => void;
}

/** How long to wait for the register to appear before giving up. */
const FIND_TIMEOUT_MS = 1500;

function findTarget(target: TourTarget): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function isShown(element: HTMLElement | null): element is HTMLElement {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  return element.checkVisibility({ checkVisibilityCSS: true });
}

/** Steps whose element is on the page and visible right now. */
function availableSteps(): TourStep[] {
  return TOUR_STEPS.filter((step) => isShown(findTarget(step.target)));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const px = (value: number) => `${Math.round(value)}px`;

export function Tour({ open, onClose }: TourProps) {
  // A fresh session (from step 1) every time the tour opens.
  return open ? <TourSession onClose={onClose} /> : null;
}

function TourSession({ onClose }: { onClose: () => void }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [moved, setMoved] = useState(false);
  const spotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const stepId = useId();
  const titleId = useId();
  const bodyId = useId();

  const close = useEffectEvent(() => onClose());

  const count = steps?.length ?? 0;
  const step = steps?.[index] ?? null;
  const isLast = index === count - 1;

  function go(to: number) {
    if (to < 0 || to >= count || to === index) return;
    setIndex(to);
    setMoved(true);
  }

  // Find the steps that apply. The screen may still be drawing (the tour can
  // start straight after switching to the register), so look on each frame
  // until the same steps are found twice in a row, or give up.
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    let previous = "";
    const look = () => {
      const found = availableSteps();
      const key = found.map((s) => s.target).join(" ");
      if (found.length > 0 && key === previous) {
        setSteps(found);
        return;
      }
      if (performance.now() - started > FIND_TIMEOUT_MS) {
        if (found.length > 0) setSteps(found);
        else close();
        return;
      }
      previous = key;
      frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Put the highlight and card in place, and keep them there as the window
  // resizes, anything scrolls, or the target or card changes size.
  useLayoutEffect(() => {
    const spot = spotRef.current;
    const card = cardRef.current;
    if (!step || !spot || !card) return;

    let frame = 0;
    const place = () => {
      frame = 0;
      const target = findTarget(step.target);
      let box: Box | null = null;
      if (isShown(target)) {
        const rect = target.getBoundingClientRect();
        box = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const layout = layoutTour(box, { width: card.offsetWidth, height: card.offsetHeight }, viewport);

      if (layout.spot) {
        spot.classList.remove("is-empty");
        spot.style.top = px(layout.spot.top);
        spot.style.left = px(layout.spot.left);
        spot.style.width = px(layout.spot.width);
        spot.style.height = px(layout.spot.height);
      } else {
        spot.classList.add("is-empty");
        spot.style.top = px(viewport.height / 2);
        spot.style.left = px(viewport.width / 2);
        spot.style.width = "0px";
        spot.style.height = "0px";
      }
      card.style.top = px(layout.card.top);
      card.style.left = px(layout.card.left);
      card.dataset.placement = layout.placement;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    const target = findTarget(step.target);
    if (isShown(target)) {
      // Does nothing if it is already fully in view.
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    place();

    const resized = new ResizeObserver(schedule);
    resized.observe(card);
    if (target) resized.observe(target);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step]);

  // Each step starts with Next focused.
  useEffect(() => {
    if (step) nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Give focus back to where it was when the tour ends, if that still exists.
  useEffect(() => {
    const before = document.activeElement;
    return () => {
      if (before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  // Keyboard: Esc skips, Left and Right go back and on, Tab stays in the card.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === "Escape") {
      handled();
      close();
    } else if (event.key === "ArrowRight") {
      handled();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      handled();
      go(index - 1);
    } else if (event.key === "Tab") {
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (buttons.length === 0) return;
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const to = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : at === -1 || at === buttons.length - 1 ? 0 : at + 1;
      handled();
      buttons[to].focus();
    }
  });
  // Focus that escapes the card (a click, a screen reader) comes back to it.
  const onFocusIn = useEffectEvent((event: FocusEvent) => {
    const card = cardRef.current;
    if (card && event.target instanceof Node && !card.contains(event.target)) nextRef.current?.focus({ preventScroll: true });
  });
  const ready = steps !== null;
  useEffect(() => {
    if (!ready) return;
    const key = (event: KeyboardEvent) => onKey(event);
    const focus = (event: FocusEvent) => onFocusIn(event);
    window.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
    };
  }, [ready]);

  if (!step) return null;

  const swallow = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return createPortal(
    <>
      <div className="tour-block" aria-hidden="true" onMouseDown={swallow} onClick={swallow} onDoubleClick={swallow} onContextMenu={swallow} />
      <div ref={spotRef} className="tour-spot" aria-hidden="true" />
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={`${stepId} ${titleId}`} aria-describedby={bodyId}>
        <div className="tour-top">
          <div className="tour-step" id={stepId}>
            Step {index + 1} of {count}
          </div>
          <div className="tour-dots" aria-hidden="true">
            {steps?.map((s, i) => (
              <i key={s.target} className={i === index ? "is-on" : undefined} />
            ))}
          </div>
        </div>
        <h2 id={titleId}>{step.title}</h2>
        <p id={bodyId}>{step.body}</p>
        <div className="tour-bar">
          <button type="button" className="btn btn--link" onClick={() => onClose()}>
            Skip tour
          </button>
          {index > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => go(index - 1)}>
              Back
            </button>
          )}
          <button ref={nextRef} type="button" className="btn btn--primary" onClick={() => (isLast ? onClose() : go(index + 1))}>
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
        {/* Announces each new step; the first is read out with the dialog. */}
        <div className="visually-hidden" aria-live="polite">
          {moved ? `Step ${index + 1} of ${count}. ${step.title}. ${step.body}` : ""}
        </div>
      </div>
    </>,
    document.body,
  );
}
