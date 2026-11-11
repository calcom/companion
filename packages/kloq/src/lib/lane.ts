/**
 * The row-binding seam. A row is whatever the host says it is: a room, a
 * person, a machine, a status, a customer. Nothing is added to `CalEvent` —
 * the host supplies the reader and its inverse instead.
 */

import type { CalEvent, CalEventPatch } from "./event-types";

export interface Lane {
  id: string;
  label: string;
  /** an optional second line, such as "Floor 2 · 8 seats" */
  sublabel?: string;
  /**
   * Row height in px. Declared, never measured from content: a known height is
   * what lets a windowing layer be added later without a rewrite. Omit and the
   * settings default applies.
   *
   * This is also what caps overlapping bookings: `height ÷ bar height`,
   * floored, is how many sub-rows the lane draws before the rest collapse
   * into the "+N more" overflow control (`lib/timeline-layout.ts`'s
   * `maxSubRows`). A lane that regularly double- or triple-books — a busy
   * room, a shift with backup coverage — wants a taller `height`, not a
   * different cap; there is no separate "max overlaps" knob.
   */
  height?: number;
  /** reserved for grouping; ignored in v1 */
  parentId?: string;
  /** arbitrary host data, handed back to the row slot untouched */
  data?: unknown;
}

export interface LaneAdapter {
  /** Which lane(s) this event occupies. An empty result hides it. */
  laneOf(event: CalEvent): string | readonly string[];
  /** The patch that moves `event` onto `laneId` — the inverse a drop needs. */
  assign(event: CalEvent, laneId: string): CalEventPatch;
}

/**
 * The common case in one line: the lane id lives in a field on the event.
 * `byResourceId()` reads `resourceId`; pass a name for anything else.
 */
export function byResourceId(field: string = "resourceId"): LaneAdapter {
  return {
    laneOf: (event) => {
      const value = (event as unknown as Record<string, unknown>)[field];
      return typeof value === "string" && value !== "" ? value : [];
    },
    assign: (_event, laneId) => ({ [field]: laneId }) as CalEventPatch,
  };
}

/**
 * An event's row position, or -1 when it has no lane or names one the host did
 * not list. An array result collapses to its first entry that IS listed;
 * rendering an event on several rows at once is a non-goal for now.
 */
export function laneIndexOf(adapter: LaneAdapter, lanes: readonly Lane[], event: CalEvent): number {
  const result = adapter.laneOf(event);
  const ids = typeof result === "string" ? [result] : result;
  for (const id of ids) {
    const i = lanes.findIndex((lane) => lane.id === id);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Split placements into one bucket per row, preserving order. Out-of-range
 * `laneIndex` values are dropped, not clamped — the same contract the
 * calendar's column bucketing has always had.
 */
export function bucketByLane<T extends { laneIndex: number }>(
  events: readonly T[],
  laneCount: number,
): T[][] {
  const buckets: T[][] = Array.from({ length: Math.max(0, laneCount) }, () => []);
  for (const e of events) {
    const bucket = buckets[e.laneIndex];
    if (bucket) bucket.push(e);
  }
  return buckets;
}
