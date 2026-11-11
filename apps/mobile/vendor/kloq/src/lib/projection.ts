/** The instant → column projection. Pure; called from one `useMemo`, never from the rAF drag loop. */

import {
  asPlacementId,
  type CalEvent,
  DAY_END_HOUR,
  DEFAULT_EVENT_COLOR,
  daysBetween,
  displayDate,
  type Instant,
  isDateOnly,
  minutesOfDate,
  type PlacedEvent,
  parseInstant,
  startOfLocalDay,
  type ViewDescriptor,
} from "./calendar-types";
import { MINUTES_PER_DAY, MS_PER_DAY } from "./date-math";
import { eventWindow, mayOverlapWindow, seriesMayOverlapWindow } from "./event-window";
import {
  type ExpandRecurrenceFn,
  getRecurrenceEngine,
  type Occurrence,
  occurrenceKey,
  segmentKey,
} from "./recurrence";

/** A `PlacedEvent` that knows which occurrence of a series it is; `occurrence` is absent for plain events. */
export interface PlacedOccurrence extends PlacedEvent {
  /** this instance's own instants — the master's, for a plain event */
  start: Instant;
  end: Instant;
  /** the store event this placement belongs to — always the master */
  source: CalEvent;
  /** absent when the event has no rule (or none we could expand) */
  occurrence?: Occurrence;
  truncated?: boolean;
}

export interface Projection {
  all: PlacedOccurrence[];
  /** a STABLE array; the engine reads it every rAF */
  timed: PlacedOccurrence[];
  allDay: PlacedOccurrence[];
}

/** The visible slice of the day in absolute minutes from midnight; defaults to the whole day. */
export interface DayBounds {
  dayStartMin?: number;
  dayEndMin?: number;
  /** Recurrence expansion: omit for the registered engine, `false` to place every master once. */
  expand?: ExpandRecurrenceFn | false;
  /** The zone the columns are drawn in; omit for the browser's own. */
  timeZone?: string;
}

export function projectEvents(
  events: readonly CalEvent[],
  view: Pick<ViewDescriptor, "days" | "dayCount">,
  bounds: DayBounds = {},
): Projection {
  const dayStartMin = bounds.dayStartMin ?? 0;
  const dayEndMin = bounds.dayEndMin ?? DAY_END_HOUR * 60;
  const all: PlacedOccurrence[] = [];
  const timed: PlacedOccurrence[] = [];
  const allDay: PlacedOccurrence[] = [];
  if (!view.days.length) return { all, timed, allDay };

  const first = startOfLocalDay(view.days[0]);
  const firstMs = first.getTime();
  // rounded so DST days still count as one day; may be outside the view
  const columnOf = (d: Date) => Math.round((startOfLocalDay(d).getTime() - firstMs) / MS_PER_DAY);

  const expand = bounds.expand ?? getRecurrenceEngine();
  const tz = bounds.timeZone;
  // one day of slack each side so spans that begin before the first column are still offered
  const range = {
    start: new Date(first.getTime() - MS_PER_DAY),
    end: new Date(startOfLocalDay(view.days[view.days.length - 1]).getTime() + 2 * MS_PER_DAY),
  };

  const place = (
    e: CalEvent,
    start: string,
    end: string,
    occurrence?: Occurrence,
    truncated?: boolean,
  ) => {
    const startMs = parseInstant(start);
    const endMs = parseInstant(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;
    // a date-only instant is a calendar day: the display zone must not shift it
    const startIsDateOnly = isDateOnly(start);
    const startDate = startIsDateOnly ? new Date(startMs) : displayDate(startMs, tz);
    const baseId = occurrence ? occurrenceKey(e.id, occurrence.start) : asPlacementId(e.id);

    if (e.allDay) {
      const startCol = columnOf(startDate);
      // all-day `end` is exclusive; a backwards or equal one still covers its start day
      const endColExclusive = Math.max(startCol + 1, columnOf(new Date(endMs)));
      const lo = Math.max(0, startCol);
      const hiExclusive = Math.min(view.dayCount, endColExclusive);
      if (hiExclusive <= lo) return;
      const placed: PlacedOccurrence = {
        ...e,
        id: baseId,
        color: e.color ?? DEFAULT_EVENT_COLOR,
        start,
        end,
        allDay: true,
        laneIndex: lo,
        endLaneIndex: hiExclusive - 1,
        dayIndex: lo,
        endDayIndex: hiExclusive - 1,
        startMin: 0,
        endMin: 0,
        segment: { i: 0, n: 1 },
        source: e,
        occurrence,
        truncated,
      };
      allDay.push(placed);
      all.push(placed);
    } else {
      const startCol = columnOf(startDate);
      if (startCol >= view.dayCount) return;
      // cheap prefilter only: a backwards event can have a negative end column with its start in view
      const endDate = displayDate(endMs, tz);
      if (startCol < 0 && columnOf(endDate) < 0) return;
      const rawStart = minutesOfDate(startDate);
      // wall-clock minutes, NOT elapsed ms, so a 1h meeting across a DST change stays 1h
      const wallStart = startIsDateOnly ? displayDate(startMs, tz) : startDate;
      const rawEnd = Math.max(
        rawStart,
        rawStart +
          daysBetween(wallStart, endDate) * MINUTES_PER_DAY +
          minutesOfDate(endDate) -
          minutesOfDate(wallStart),
      );
      // `n` counts the event's own days, not the visible ones, so segment ids are view-independent
      const n = rawEnd > rawStart ? Math.ceil(rawEnd / MINUTES_PER_DAY) : 1;
      if (startCol + n - 1 < 0) return;

      for (let i = 0; i < n; i += 1) {
        const col = startCol + i;
        if (col < 0) continue;
        if (col >= view.dayCount) break;
        const segStart = i === 0 ? rawStart : 0;
        const segEnd = Math.min(rawEnd - i * MINUTES_PER_DAY, MINUTES_PER_DAY);
        // segments outside a clipped day range are dropped; a zero-length event at the top edge survives
        if (segStart >= dayEndMin) continue;
        if (segEnd <= dayStartMin && segEnd > segStart) continue;
        const startMin = Math.max(dayStartMin, segStart);
        const endMin = Math.max(startMin, Math.min(dayEndMin, segEnd));
        const placed: PlacedOccurrence = {
          ...e,
          id: segmentKey(baseId, i, n),
          color: e.color ?? DEFAULT_EVENT_COLOR,
          start,
          end,
          allDay: false,
          laneIndex: col,
          endLaneIndex: col,
          dayIndex: col,
          endDayIndex: col,
          startMin,
          endMin,
          segment: { i, n },
          source: e,
          occurrence,
          truncated,
        };
        timed.push(placed);
        all.push(placed);
      }
    }
  };

  // conservative string-compare prefilter; never drops anything `place` would keep
  const visible = eventWindow(first, view.days[view.days.length - 1]);

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
  return { all, timed, allDay };
}
