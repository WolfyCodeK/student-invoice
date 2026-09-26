import { describe, expect, it } from "vitest";
import { CARD_GAP, CARD_MARGIN, layoutTour, SPOT_PADDING, spotFor, type Box, type Size } from "./tour-layout";

const WINDOW: Size = { width: 1280, height: 720 };
const CARD: Size = { width: 340, height: 200 };

function insideWindow(card: { top: number; left: number }, size: Size = CARD, viewport: Size = WINDOW) {
  expect(card.left).toBeGreaterThanOrEqual(CARD_MARGIN);
  expect(card.top).toBeGreaterThanOrEqual(CARD_MARGIN);
  expect(card.left + size.width).toBeLessThanOrEqual(viewport.width - CARD_MARGIN);
  expect(card.top + size.height).toBeLessThanOrEqual(viewport.height - CARD_MARGIN);
}

describe("spotFor", () => {
  it("pads the target on every side", () => {
    expect(spotFor({ top: 100, left: 200, width: 50, height: 30 }, WINDOW)).toEqual({
      top: 100 - SPOT_PADDING,
      left: 200 - SPOT_PADDING,
      width: 50 + 2 * SPOT_PADDING,
      height: 30 + 2 * SPOT_PADDING,
    });
  });

  it("trims to the window so the ring stays visible", () => {
    const spot = spotFor({ top: 0, left: 1200, width: 200, height: 40 }, WINDOW)!;
    expect(spot.top).toBeGreaterThan(0);
    expect(spot.left + spot.width).toBeLessThan(WINDOW.width);
  });

  it("is null when the target is off screen", () => {
    expect(spotFor({ top: 900, left: 10, width: 100, height: 40 }, WINDOW)).toBeNull();
  });
});

describe("layoutTour", () => {
  it("puts the card below a target when there's room, centred on it", () => {
    const target: Box = { top: 60, left: 400, width: 200, height: 40 };
    const { card, placement, spot } = layoutTour(target, CARD, WINDOW);
    expect(placement).toBe("below");
    expect(card.top).toBe(spot!.top + spot!.height + CARD_GAP);
    expect(card.left + CARD.width / 2).toBe(target.left + target.width / 2);
    insideWindow(card);
  });

  it("keeps a card below a title-bar button inside the window's right edge", () => {
    const { card, placement } = layoutTour({ top: 4, left: 1180, width: 90, height: 32 }, CARD, WINDOW);
    expect(placement).toBe("below");
    insideWindow(card);
  });

  it("puts the card above a target near the bottom", () => {
    const target: Box = { top: 640, left: 100, width: 200, height: 40 };
    const { card, placement, spot } = layoutTour(target, CARD, WINDOW);
    expect(placement).toBe("above");
    expect(card.top + CARD.height).toBe(spot!.top - CARD_GAP);
    insideWindow(card);
  });

  it("puts the card beside a tall target, on the side with room", () => {
    const grid: Box = { top: 150, left: 0, width: 820, height: 570 };
    const right = layoutTour(grid, CARD, WINDOW);
    expect(right.placement).toBe("right");
    expect(right.card.left).toBe(right.spot!.left + right.spot!.width + CARD_GAP);
    insideWindow(right.card);

    const panel: Box = { top: 150, left: 820, width: 460, height: 570 };
    const left = layoutTour(panel, CARD, WINDOW);
    expect(left.placement).toBe("left");
    expect(left.card.left + CARD.width).toBe(left.spot!.left - CARD_GAP);
    insideWindow(left.card);
  });

  it("sits over a target that fills the window, still inside it", () => {
    const { card, placement } = layoutTour({ top: 0, left: 0, width: 1280, height: 720 }, CARD, WINDOW);
    expect(placement).toBe("over");
    insideWindow(card);
  });

  it("centres the card when there is nothing to highlight", () => {
    const { card, placement, spot } = layoutTour(null, CARD, WINDOW);
    expect(spot).toBeNull();
    expect(placement).toBe("centre");
    expect(card).toEqual({ top: (720 - 200) / 2, left: (1280 - 340) / 2 });
  });

  it("stays inside the smallest window the app allows", () => {
    const small: Size = { width: 960, height: 600 };
    for (const target of [
      { top: 4, left: 700, width: 250, height: 32 },
      { top: 150, left: 0, width: 620, height: 450 },
      { top: 150, left: 620, width: 340, height: 450 },
      { top: 560, left: 20, width: 920, height: 40 },
    ]) {
      insideWindow(layoutTour(target, CARD, small).card, CARD, small);
    }
  });
});
