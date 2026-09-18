/**
 * A device is treated as a tablet (iPad / large Android tablet) when its
 * shortest side is at least this many density-independent pixels. Using the
 * shortest side keeps the classification stable across orientation changes.
 */
export const TABLET_MIN_SHORTEST_SIDE = 600;

/**
 * Pure classifier for tablet-sized windows. Compares the shortest side so a
 * device keeps the same classification in portrait and landscape.
 */
export function isTabletSize(width: number, height: number): boolean {
  return Math.min(width, height) >= TABLET_MIN_SHORTEST_SIDE;
}
