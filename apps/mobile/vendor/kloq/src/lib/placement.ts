/** A store event placed into the current view. */
import type { Attendee, CalEvent, EventColor } from "./event-types";

/**
 * The id of a PLACEMENT, not a store event. One of:
 *  - the bare store id, for a plain event inside one day;
 *  - `` `${masterId}#${occurrenceStart}` `` for one instance of a series;
 *  - `` `${id}@${segmentIndex}` `` for one day-slice of a cross-midnight event (suffixes compose in that order).
 * `masterIdOf` is the only bridge back to a store id.
 */
export type PlacementId = string & { readonly __placement: unique symbol };

/** Assert a string is a placement id. Only the projection and DOM readers (`data-cal-event`) may call this. */
export const asPlacementId = (id: string): PlacementId => id as PlacementId;

/** A STORE id — any string that is *not* a {@link PlacementId}; makes `store.update(placed.id)` a compile error. */
export type StoreId = string & { readonly __placement?: never };

export interface PlacedEvent {
  id: PlacementId;
  title: string;
  description?: string;
  /** resolved via `resolveEventColor`; `source.color` is the event's own */
  color: EventColor;

  location?: string;
  meetingUrl?: string;
  attendees?: Attendee[];
  busy?: boolean;
  readOnly?: boolean;
  calendarId?: string;

  allDay: boolean;
  /** the row this placement sits on: a visible column in the calendar, a resource in a timeline */
  laneIndex: number;
  /** inclusive last row; `=== laneIndex` for a timed event and for every timeline bar */
  endLaneIndex: number;
  /** @deprecated use `laneIndex`. Populated with the same value; removed next release. */
  dayIndex: number;
  /** @deprecated use `endLaneIndex`. Populated with the same value; removed next release. */
  endDayIndex: number;
  startMin: number;
  endMin: number;
  /** piece `i` of `n` over the EVENT's days (not the visible ones); `{ i: 0, n: 1 }` when it fits in one day */
  segment: { i: number; n: number };
  /** the store event this placement came from */
  source: CalEvent;
}

/** Does this placement's leading edge cut mid-event? */
export const continuesBefore = (e: Pick<PlacedEvent, "segment">): boolean => e.segment.i > 0;

/** Does this placement's trailing edge cut into the next day? */
export const continuesAfter = (e: Pick<PlacedEvent, "segment">): boolean =>
  e.segment.i < e.segment.n - 1;

/** Canonical Monday-first short names. Fallback only — pass `view.namesShort` for user-visible labels. */
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Thu – Fri" for a span of visible columns; `names` is per-column (`view.namesShort`). */
export function formatDaySpan(
  startDay: number,
  endDay: number,
  names: string[] = DAY_NAMES_SHORT,
): string {
  const a = names[startDay] ?? `Day ${startDay + 1}`;
  const b = names[endDay] ?? `Day ${endDay + 1}`;
  return startDay === endDay ? a : `${a} – ${b}`;
}
