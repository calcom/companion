/**
 * The instant → (lane, span) projection for a timeline. A sibling of
 * `projectEvents`, sharing its prefilters and recurrence expansion.
 *
 * Two deliberate differences from the calendar's projection:
 *  - lanes resolve through the host's adapter, not from the column's date;
 *  - there is NO midnight segmentation. A booking that crosses midnight is one
 *    continuous bar, so `segment` is always `{ i: 0, n: 1 }`.
 */

import { asPlacementId, type CalEvent, DEFAULT_EVENT_COLOR, parseInstant } from "./calendar-types";
import { eventWindow, mayOverlapWindow, seriesMayOverlapWindow } from "./event-window";
import { type Lane, type LaneAdapter, laneIndexOf } from "./lane";
import type { PlacedOccurrence } from "./projection";
import {
  type ExpandRecurrenceFn,
  getRecurrenceEngine,
  type Occurrence,
  occurrenceKey,
} from "./recurrence";
import { minutesFromStart, type TimelineWindow } from "./timeline-window";

export interface TimelineProjection {
  /** a STABLE array; the engine reads it every rAF */
  all: PlacedOccurrence[];
}

export interface TimelineBounds {
  /** Recurrence expansion: omit for the registered engine, `false` to place every master once. */
  expand?: ExpandRecurrenceFn | false;
}

export function projectTimeline(
  events: readonly CalEvent[],
  lanes: readonly Lane[],
  window: TimelineWindow,
  adapter: LaneAdapter,
  bounds: TimelineBounds = {},
): TimelineProjection {
  const all: PlacedOccurrence[] = [];
  if (!lanes.length) return { all };

  const totalMin = minutesFromStart(window, window.end);
  const expand = bounds.expand ?? getRecurrenceEngine();
  const range = { start: window.start, end: window.end };

  const place = (
    e: CalEvent,
    start: string,
    end: string,
    occurrence?: Occurrence,
    truncated?: boolean,
  ) => {
    const laneIndex = laneIndexOf(adapter, lanes, e);
    if (laneIndex === -1) return;

    const startMs = parseInstant(start);
    const endMs = parseInstant(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;

    const rawStart = minutesFromStart(window, startMs);
    const rawEnd = Math.max(rawStart, minutesFromStart(window, endMs));
    // half-open: an event ending exactly at the left edge is outside
    if (rawEnd <= 0 || rawStart >= totalMin) return;

    const startMin = Math.max(0, rawStart);
    const endMin = Math.min(totalMin, rawEnd);

    all.push({
      ...e,
      id: occurrence ? occurrenceKey(e.id, occurrence.start) : asPlacementId(e.id),
      color: e.color ?? DEFAULT_EVENT_COLOR,
      start,
      end,
      allDay: e.allDay ?? false,
      laneIndex,
      endLaneIndex: laneIndex,
      dayIndex: laneIndex,
      endDayIndex: laneIndex,
      startMin,
      endMin,
      segment: { i: 0, n: 1 },
      source: e,
      occurrence,
      truncated,
    });
  };

  const visible = eventWindow(window.start, window.end);

  for (const e of events) {
    if (!e.rrule || expand === false) {
      if (!mayOverlapWindow(e, visible)) continue;
      place(e, e.start, e.end);
      continue;
    }
    if (!seriesMayOverlapWindow(e.rrule, e.start, visible)) continue;
    const { occurrences, truncated } = expand(e, range);
    for (const occ of occurrences) place(e, occ.start, occ.end, occ, truncated);
  }
  return { all };
}
