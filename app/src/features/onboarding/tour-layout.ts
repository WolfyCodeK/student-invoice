// Where the guided tour draws its highlight and its text box. Pure geometry in
// window (CSS pixel) coordinates, so it can be tested without a browser.

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type CardPlacement = "below" | "above" | "right" | "left" | "over" | "centre";

export interface TourLayout {
  /** The highlighted area, or null when there is nothing on screen to highlight. */
  spot: Box | null;
  card: { top: number; left: number };
  placement: CardPlacement;
}

/** Space around the target inside the highlight. */
export const SPOT_PADDING = 6;
/** The card never comes closer than this to the window's edges. */
export const CARD_MARGIN = 12;
/** Space between the highlight and the card. */
export const CARD_GAP = 12;
/** The highlight's ring is drawn outside its box; keep it on screen. */
const RING = 3;

function clamp(value: number, min: number, max: number): number {
  // If the window is smaller than the card, pin it to the start edge.
  return Math.max(min, Math.min(value, max));
}

/** The target's box plus padding, trimmed to what is on screen. */
export function spotFor(target: Box, viewport: Size): Box | null {
  const top = Math.max(target.top - SPOT_PADDING, RING);
  const left = Math.max(target.left - SPOT_PADDING, RING);
  const bottom = Math.min(target.top + target.height + SPOT_PADDING, viewport.height - RING);
  const right = Math.min(target.left + target.width + SPOT_PADDING, viewport.width - RING);
  if (bottom - top < 1 || right - left < 1) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * Places the card beside the highlight: below it if there's room, else above,
 * else to the side with room, else over it near the bottom. Always inside the
 * window with CARD_MARGIN to spare.
 */
export function layoutTour(target: Box | null, card: Size, viewport: Size): TourLayout {
  const minLeft = CARD_MARGIN;
  const maxLeft = viewport.width - CARD_MARGIN - card.width;
  const minTop = CARD_MARGIN;
  const maxTop = viewport.height - CARD_MARGIN - card.height;

  const spot = target ? spotFor(target, viewport) : null;
  if (!spot) {
    return {
      spot: null,
      card: { top: clamp((viewport.height - card.height) / 2, minTop, maxTop), left: clamp((viewport.width - card.width) / 2, minLeft, maxLeft) },
      placement: "centre",
    };
  }

  const spotBottom = spot.top + spot.height;
  const spotRight = spot.left + spot.width;
  const centredLeft = clamp(spot.left + spot.width / 2 - card.width / 2, minLeft, maxLeft);
  const centredTop = clamp(spot.top + spot.height / 2 - card.height / 2, minTop, maxTop);

  const below = spotBottom + CARD_GAP;
  if (below <= maxTop) return { spot, card: { top: below, left: centredLeft }, placement: "below" };

  const above = spot.top - CARD_GAP - card.height;
  if (above >= minTop) return { spot, card: { top: above, left: centredLeft }, placement: "above" };

  const right = spotRight + CARD_GAP;
  const left = spot.left - CARD_GAP - card.width;
  const roomRight = right <= maxLeft;
  const roomLeft = left >= minLeft;
  if (roomRight && (!roomLeft || viewport.width - spotRight >= spot.left)) {
    return { spot, card: { top: centredTop, left: right }, placement: "right" };
  }
  if (roomLeft) return { spot, card: { top: centredTop, left }, placement: "left" };

  // No room outside it: sit over the highlight, near its bottom edge.
  return {
    spot,
    card: { top: clamp(spotBottom - CARD_MARGIN - card.height, minTop, maxTop), left: centredLeft },
    placement: "over",
  };
}
