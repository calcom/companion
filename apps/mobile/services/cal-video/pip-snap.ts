/**
 * Where the floating self-view may rest: the four corners of the stage, inside the header and
 * the tray. Dragging it anywhere else lets it go to the nearest corner, with a flick carrying it
 * in the direction of the throw.
 */
export type PipCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const PIP_CORNERS: readonly PipCorner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export interface PipBounds {
  /** Size of the surface the tile floats over. */
  width: number;
  height: number;
  /** Size of the tile itself. */
  pipWidth: number;
  pipHeight: number;
  /** Space kept clear at each edge: header above, tray below, a margin at the sides. */
  top: number;
  bottom: number;
  side: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The tile's top-left offset when parked in a corner. */
export function cornerPosition(corner: PipCorner, bounds: PipBounds): Point {
  "worklet";
  const x = corner.endsWith("left") ? bounds.side : bounds.width - bounds.side - bounds.pipWidth;
  const y = corner.startsWith("top")
    ? bounds.top
    : bounds.height - bounds.bottom - bounds.pipHeight;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/** How far a flick carries on after the finger lifts, in seconds of velocity. */
const FLICK_PROJECTION_S = 0.15;

/**
 * The corner a released tile should settle in: the nearest one to where it would coast, so a
 * quick flick toward a corner lands there even if the finger let go early.
 */
export function nearestCorner(position: Point, velocity: Point, bounds: PipBounds): PipCorner {
  "worklet";
  const projected = {
    x: position.x + velocity.x * FLICK_PROJECTION_S,
    y: position.y + velocity.y * FLICK_PROJECTION_S,
  };
  let best: PipCorner = "bottom-right";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const corner of PIP_CORNERS) {
    const target = cornerPosition(corner, bounds);
    const distance = (target.x - projected.x) ** 2 + (target.y - projected.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = corner;
    }
  }
  return best;
}
