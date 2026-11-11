/**
 * The geometry seam. Both the calendar's time grid and a timeline are
 * (lane, time-span) pairs; they differ only in which screen axis time runs
 * along and what instant minutes are measured from. An axis is that difference,
 * and nothing else.
 *
 * Minutes are always measured FROM THE WINDOW ORIGIN. For the calendar that
 * origin is a column's local midnight, so the numbers are the same
 * minutes-from-midnight the grid has always used.
 */

export interface KloqAxis {
  /** which screen axis time runs along */
  readonly orientation: "x" | "y";
  /** minutes from the window origin, to px along the axis */
  toPx(min: number): number;
  /** px along the axis, back to minutes from the window origin */
  pxToMinutes(px: number): number;
  /** a DURATION in minutes to a px length; no origin offset */
  durationToPx(min: number): number;
  /** a px LENGTH back to a duration in minutes; no origin offset */
  pxToDuration(px: number): number;
  /** hold a minute inside the window */
  clamp(min: number): number;
  /** first minute of the window */
  readonly startMin: number;
  /** last minute of the window */
  readonly endMin: number;
  /** total px the window occupies */
  readonly extentPx: number;
}

export interface VerticalAxisConfig {
  /** px per hour */
  hourHeight: number;
  /** the top of the canvas, in absolute minutes from midnight */
  dayStartMin: number;
  /** the bottom of the canvas, in absolute minutes from midnight */
  dayEndMin: number;
}

/**
 * The calendar's axis: time runs down, the origin is local midnight, and the
 * window is the (possibly clipped) day. Arithmetic here is deliberately
 * identical to what `createSettings` computed inline before the extraction.
 */
export function createVerticalAxis({
  hourHeight,
  dayStartMin,
  dayEndMin,
}: VerticalAxisConfig): KloqAxis {
  const perMin = hourHeight / 60;
  return {
    orientation: "y",
    toPx: (min) => (min - dayStartMin) * perMin,
    pxToMinutes: (px) => px / perMin + dayStartMin,
    durationToPx: (min) => min * perMin,
    pxToDuration: (px) => px / perMin,
    clamp: (min) => Math.max(dayStartMin, Math.min(dayEndMin, min)),
    startMin: dayStartMin,
    endMin: dayEndMin,
    extentPx: (dayEndMin - dayStartMin) * perMin,
  };
}
