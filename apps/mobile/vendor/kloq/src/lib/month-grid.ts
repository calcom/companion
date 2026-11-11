/**
 * Packs a month's placements into 6×7 cells: one bar per multi-day event per week row, longest first,
 * with the last slot demoted to make room for `+N more` where a day overflows.
 */

import { continuesAfter, continuesBefore, type PlacedEvent } from "./calendar-types";
import { clamp } from "./date-math";

export interface MonthChip {
  event: PlacedEvent;
  /** week row */
  week: number;
  /** first column of this row segment, 0–6 */
  startCol: number;
  /** last column, inclusive, 0–6 */
  endCol: number;
  /** first day index over the whole grid */
  startDay: number;
  /** last day index, inclusive */
  endDay: number;
  /** stacking row within the cell */
  slot: number;
  /** the event began before this segment */
  continuesBefore: boolean;
  /** the event runs past this segment */
  continuesAfter: boolean;
}

export interface MonthLayout {
  chips: MonthChip[];
  /** per day index: how many events have no chip */
  overflow: number[];
  /** per day index: every event on that day, in display order */
  byDay: PlacedEvent[][];
}

/** Display order within a day: all-day first, then start, then title, then id (stable). */
export function compareForDay(a: PlacedEvent, b: PlacedEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.startMin !== b.startMin) return a.startMin - b.startMin;
  const t = (a.title || "").localeCompare(b.title || "");
  return t !== 0 ? t : a.id.localeCompare(b.id);
}

// widest span first (a bar needs contiguous room), then earliest column
function compareForPacking(a: PlacedEvent, b: PlacedEvent): number {
  const wa = a.endDayIndex - a.dayIndex;
  const wb = b.endDayIndex - b.dayIndex;
  if (wa !== wb) return wb - wa;
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  return compareForDay(a, b);
}

interface MonthLayoutOptions {
  /** columns in the grid */
  dayCount: number;
  /** chip rows a cell can show */
  slots: number;
}

export function layoutMonth(
  events: readonly PlacedEvent[],
  { dayCount, slots }: MonthLayoutOptions,
): MonthLayout {
  const byDay: PlacedEvent[][] = Array.from({ length: dayCount }, () => []);
  const overflow = new Array<number>(dayCount).fill(0);
  if (dayCount <= 0) return { chips: [], overflow: [], byDay: [] };

  const spanOf = (e: PlacedEvent): [number, number] | null => {
    const lo = clamp(e.dayIndex, 0, dayCount - 1);
    const hi = clamp(Math.max(e.dayIndex, e.endDayIndex), 0, dayCount - 1);
    if (e.endDayIndex < 0 || e.dayIndex > dayCount - 1) return null;
    return [lo, hi];
  };

  for (const e of events) {
    const span = spanOf(e);
    if (!span) continue;
    for (let d = span[0]; d <= span[1]; d++) byDay[d].push(e);
  }
  for (const list of byDay) list.sort(compareForDay);

  const chips: MonthChip[] = [];
  if (slots > 0) {
    const taken = Array.from({ length: dayCount }, () => new Array<boolean>(slots).fill(false));
    for (const e of [...events].sort(compareForPacking)) {
      const span = spanOf(e);
      if (!span) continue;
      const [lo, hi] = span;
      for (let week = Math.floor(lo / 7); week <= Math.floor(hi / 7); week++) {
        const s = Math.max(lo, week * 7);
        const t = Math.min(hi, week * 7 + 6, dayCount - 1);
        if (s > t) continue;
        let slot = -1;
        for (let k = 0; k < slots && slot < 0; k++) {
          let free = true;
          for (let d = s; d <= t && free; d++) free = !taken[d][k];
          if (free) slot = k;
        }
        if (slot < 0) continue;
        for (let d = s; d <= t; d++) taken[d][slot] = true;
        chips.push({
          event: e,
          week,
          startCol: s % 7,
          endCol: t % 7,
          startDay: s,
          endDay: t,
          slot,
          // cut by the week row, or by a cross-midnight segment
          continuesBefore: e.dayIndex < s || continuesBefore(e),
          continuesAfter: Math.max(e.dayIndex, e.endDayIndex) > t || continuesAfter(e),
        });
      }
    }
  }

  // demoting a bar can tip a neighbouring day into overflow, so this runs to a fixed point
  const coveredCounts = () => {
    const covered = new Array<number>(dayCount).fill(0);
    for (const c of chips) for (let d = c.startDay; d <= c.endDay; d++) covered[d]++;
    return covered;
  };

  for (let guard = chips.length; guard >= 0; guard--) {
    const covered = coveredCounts();
    let removed = false;
    for (let d = 0; d < dayCount && !removed; d++) {
      if (byDay[d].length <= covered[d]) continue;
      const i = chips.findIndex((c) => c.slot === slots - 1 && c.startDay <= d && d <= c.endDay);
      if (i < 0) continue;
      chips.splice(i, 1);
      removed = true;
    }
    if (!removed) break;
  }

  const covered = coveredCounts();
  for (let d = 0; d < dayCount; d++) overflow[d] = Math.max(0, byDay[d].length - covered[d]);

  return { chips, overflow, byDay };
}

/** Events hidden on `day`, in display order. */
export function hiddenOn(layout: MonthLayout, day: number): PlacedEvent[] {
  const shown = new Set<string>();
  for (const c of layout.chips) if (c.startDay <= day && day <= c.endDay) shown.add(c.event.id);
  return (layout.byDay[day] ?? []).filter((e) => !shown.has(e.id));
}
