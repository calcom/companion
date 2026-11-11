/**
 * Year view: twelve mini-month grids and a per-day busy-minutes density. Counts events in one pass
 * over the store instead of running 365 columns through `projectEvents`.
 */

import {
  addDays,
  type CalEvent,
  daysBetween,
  displayDate,
  type Instant,
  isBusy,
  MONTH_WEEKS,
  minutesOfDate,
  parseInstant,
  startOfLocalDay,
  startOfWeek,
  toDateOnlyString,
  YEAR_MONTHS,
} from "./calendar-types";
import { MINUTES_PER_DAY } from "./date-math";
import { plural } from "./event-text";
import { type ExpandRecurrenceFn, getRecurrenceEngine } from "./recurrence";

/** One slot in a mini-month: a real local-midnight date, or a pad. */
export type YearCell = Date | null;

export interface YearMonth {
  /** 0 = January … 11 = December */
  index: number;
  /** local midnight on the 1st */
  first: Date;
  /** `MONTH_WEEKS` rows of 7; leading and trailing pads are `null` */
  weeks: YearCell[][];
}

/** Twelve mini-months for `year`, each a fixed 6×7. Pads are `null`, not adjacent-month days. */
export function buildYearGrid(year: number, weekStartsOn = 1): YearMonth[] {
  return Array.from({ length: YEAR_MONTHS }, (_, index) => {
    const first = new Date(year, index, 1);
    const length = daysBetween(first, new Date(year, index + 1, 1));
    const gridStart = startOfWeek(first, weekStartsOn);
    const lead = daysBetween(gridStart, first);

    const weeks: YearCell[][] = [];
    for (let w = 0; w < MONTH_WEEKS; w++) {
      const row: YearCell[] = [];
      for (let c = 0; c < 7; c++) {
        const day = w * 7 + c - lead;
        row.push(day >= 0 && day < length ? addDays(first, day) : null);
      }
      weeks.push(row);
    }
    return { index, first, weeks };
  });
}

/** Seven week-aligned dates for a mini-month's header row; the view formats them itself. */
export function weekdayColumns(weekStartsOn = 1): Date[] {
  const start = startOfWeek(new Date(2001, 0, 1), weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Heat steps. `0` is an empty day; `4` is full. */
export type DensityBucket = 0 | 1 | 2 | 3 | 4;

/** How many non-empty steps the ramp has. */
export const DENSITY_LEVELS = 4;

/** The reference "full day of meetings" in minutes; deliberately not the drawn day window. */
export const FULL_DAY_MINUTES = 480;

/** What one day of the year holds. */
export interface DayLoad {
  /** events touching this day, free time included */
  count: number;
  /** wall-clock minutes booked busy */
  minutes: number;
  bucket: DensityBucket;
}

/** An empty day. */
export const EMPTY_DAY: DayLoad = { count: 0, minutes: 0, bucket: 0 };

/** Busy minutes → heat step, on quarters of a nominal day. */
export function densityBucket(
  minutes: number,
  fullDayMinutes: number = FULL_DAY_MINUTES,
): DensityBucket {
  if (!(minutes > 0)) return 0;
  const full = fullDayMinutes > 0 ? fullDayMinutes : FULL_DAY_MINUTES;
  const share = minutes / full;
  if (share >= 1) return 4;
  if (share >= 0.5) return 3;
  if (share >= 0.25) return 2;
  return 1;
}

export interface YearDensityOptions {
  /** first day to count, inclusive */
  start: Date;
  /** last day to count, EXCLUSIVE */
  end: Date;
  /** the zone the days are measured in; omit for the browser's */
  timeZone?: string;
  /** see {@link FULL_DAY_MINUTES} */
  fullDayMinutes?: number;
  /** recurrence expansion; omit for the registered engine, `false` to count each master once */
  expand?: ExpandRecurrenceFn | false;
}

/** Day loads for every day in `[start, end)`, keyed by `"YYYY-MM-DD"`. Empty days are absent; see {@link loadOn}. */
export function densityByDay(
  events: readonly CalEvent[],
  opts: YearDensityOptions,
): Map<string, DayLoad> {
  const { start, end, timeZone, fullDayMinutes = FULL_DAY_MINUTES } = opts;
  const out = new Map<string, DayLoad>();
  const from = startOfLocalDay(start);
  const to = startOfLocalDay(end);
  if (daysBetween(from, to) <= 0) return out;

  const add = (day: Date, minutes: number) => {
    if (day.getTime() < from.getTime() || day.getTime() >= to.getTime()) return;
    const key = toDateOnlyString(day);
    const cur = out.get(key);
    if (cur) {
      cur.count += 1;
      cur.minutes += minutes;
    } else {
      out.set(key, { count: 1, minutes, bucket: 0 });
    }
  };

  const expand = opts.expand ?? getRecurrenceEngine();
  // one day of slack at each end so a span starting the day before the window is still offered
  const range = { start: addDays(from, -1), end: addDays(to, 1) };

  const tally = (e: CalEvent, startAt: Instant, endAt: Instant) => {
    const startMs = parseInstant(startAt);
    const endMs = parseInstant(endAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;
    // all-day events are calendar days and are never re-clocked by a zone
    const busyMinutes = isBusy(e) ? fullDayMinutes : 0;

    if (e.allDay) {
      const first = startOfLocalDay(new Date(startMs));
      const span = Math.max(1, daysBetween(first, new Date(endMs)));
      for (let i = 0; i < span; i++) add(addDays(first, i), busyMinutes);
      return;
    }

    const s = displayDate(startMs, timeZone);
    const t = displayDate(endMs, timeZone);
    const spanDays = daysBetween(s, t);
    const sMin = minutesOfDate(s);
    const tMin = minutesOfDate(t);
    const day0 = startOfLocalDay(s);
    const busy = isBusy(e);
    if (spanDays <= 0) {
      add(day0, busy ? Math.max(0, tMin - sMin) : 0);
      return;
    }
    // split across midnight in wall-clock minutes, never elapsed ms
    add(day0, busy ? MINUTES_PER_DAY - sMin : 0);
    for (let i = 1; i < spanDays; i++) add(addDays(day0, i), busy ? MINUTES_PER_DAY : 0);
    if (tMin > 0) add(addDays(day0, spanDays), busy ? tMin : 0);
  };

  for (const e of events) {
    if (!e.rrule || expand === false) {
      tally(e, e.start, e.end);
      continue;
    }
    for (const occ of expand(e, range).occurrences) tally(e, occ.start, occ.end);
  }

  // floor at 1: a day holding only free events must not paint blank while its label says "2 events"
  for (const load of out.values())
    load.bucket = Math.max(
      load.count > 0 ? 1 : 0,
      densityBucket(load.minutes, fullDayMinutes),
    ) as DensityBucket;

  return out;
}

/** The load on one day; an absent day is an empty one. */
export function loadOn(density: ReadonlyMap<string, DayLoad>, day: Date): DayLoad {
  return density.get(toDateOnlyString(day)) ?? EMPTY_DAY;
}

/** How much `--foreground` each step mixes in, as a percentage. Capped at 26% so it never rivals the today badge. */
export const DENSITY_MIX: readonly number[] = [0, 7, 13, 19, 26];

/** The `background` for a heat step — `"transparent"` for an empty day. */
export function densityFill(bucket: DensityBucket): string {
  const mix = DENSITY_MIX[bucket] ?? 0;
  if (mix <= 0) return "transparent";
  return `color-mix(in oklab, var(--foreground) ${mix}%, transparent)`;
}

/** How a day's load reads out loud: "4 events". */
export function describeLoad(load: DayLoad): string {
  if (load.count === 0) return "no events";
  return plural(load.count, "event");
}
