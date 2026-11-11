/** Agenda: a chronological list grouped by day. Empty days are dropped; multi-day events appear on every day. */

import {
  continuesAfter,
  continuesBefore,
  type PlacedEvent,
  type ViewDescriptor,
} from "./calendar-types";
import { compareForDay } from "./month-grid";

export interface AgendaEntry {
  event: PlacedEvent;
  /** the event began before this row */
  continuesBefore: boolean;
  /** the event runs past this day */
  continuesAfter: boolean;
  /** the same placement id on a later day; must not register a node or take a tab stop */
  repeat: boolean;
}

export interface AgendaDay {
  /** visible column index */
  dayIndex: number;
  date: Date;
  /** `view.namesLong[dayIndex]` */
  nameLong: string;
  isToday: boolean;
  entries: AgendaEntry[];
}

export interface Agenda {
  /** days with at least one event, in order */
  days: AgendaDay[];
  /** how many days in the range had nothing */
  emptyDays: number;
  /** the searched range */
  firstDay?: Date;
  lastDay?: Date;
}

export function groupAgenda(
  events: readonly PlacedEvent[],
  view: Pick<ViewDescriptor, "days" | "dayCount" | "namesLong" | "todayIndex">,
): Agenda {
  const dayCount = Math.min(view.dayCount, view.days.length);
  if (dayCount <= 0) return { days: [], emptyDays: 0 };

  const buckets: PlacedEvent[][] = Array.from({ length: dayCount }, () => []);
  for (const e of events) {
    const lo = Math.max(0, e.dayIndex);
    const hi = Math.min(dayCount - 1, Math.max(e.dayIndex, e.endDayIndex));
    if (hi < lo) continue;
    for (let d = lo; d <= hi; d++) buckets[d].push(e);
  }

  const days: AgendaDay[] = [];
  let emptyDays = 0;
  for (let d = 0; d < dayCount; d++) {
    if (!buckets[d].length) {
      emptyDays++;
      continue;
    }
    buckets[d].sort(compareForDay);
    days.push({
      dayIndex: d,
      date: view.days[d],
      nameLong: view.namesLong[d] ?? "",
      isToday: d === view.todayIndex,
      entries: buckets[d].map((event) => ({
        event,
        continuesBefore: event.dayIndex < d || continuesBefore(event),
        continuesAfter: Math.max(event.dayIndex, event.endDayIndex) > d || continuesAfter(event),
        // segments have distinct ids, so each owns its own node
        repeat: event.dayIndex < d,
      })),
    });
  }

  return {
    days,
    emptyDays,
    firstDay: view.days[0],
    lastDay: view.days[dayCount - 1],
  };
}
