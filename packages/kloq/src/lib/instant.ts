/** Instants: serialised points in time and the wall-clock arithmetic over them. */

import { MINUTES_PER_DAY, MS_PER_DAY, pad2, sameDay } from "./date-math";
import { formatInstantInZone, type InstantLike, toMs, unzonedInstant, zonedDate } from "./timezone";
import type { DayColumns } from "./view";

/** A `Date` whose local getters read `timeZone`'s wall clock, or a plain `Date` when no zone is given. */
export function displayDate(t: InstantLike, timeZone?: string): Date {
  return timeZone ? zonedDate(t, timeZone) : new Date(toMs(t));
}

/** Now, on the display zone's clock. */
export function displayNow(timeZone?: string): Date {
  return displayDate(Date.now(), timeZone);
}

/** A serialised point in time: RFC 3339 with offset (`"2026-02-11T09:30:00+01:00"`) or date-only (`"2026-02-11"`). */
export type Instant = string;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Is this a date-only (all-day) value? A shape check, not a validity check. */
export function isDateOnly(s: Instant): boolean {
  return DATE_ONLY.test(s);
}

/** Epoch ms for an instant, or `NaN`. Date-only values resolve to LOCAL midnight, never UTC. */
export function parseInstant(s: Instant): number {
  const m = DATE_ONLY.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Date.parse(s);
}

/** Local calendar day of a Date as `"YYYY-MM-DD"`. */
export function toDateOnlyString(d: Date): Instant {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Midnight at the start of `d`'s local day. Never mutates the input. */
export function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** `n` days later (or earlier) in local calendar terms. Never mutates. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Visible column holding `d`'s local day, or -1 when it's off-screen. */
export function columnOfDate(view: DayColumns, d: Date): number {
  return view.days.findIndex((day) => sameDay(day, d));
}

/** Minutes from local midnight — the grid's y axis. Seconds are dropped. */
export function minutesOfDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Whole local calendar days from `a` to `b`. Rounds, so a 23/25-hour DST day counts as one. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / MS_PER_DAY);
}

/**
 * Duration in WALL-CLOCK minutes, not elapsed ms, so a 1h meeting across a DST change stays 1h.
 * `timeZone` must be the display zone when one is set. Returns 0 if either instant is unparseable.
 */
export function wallMinutesBetween(start: Instant, end: Instant, timeZone?: string): number {
  const a = parseInstant(start);
  const b = parseInstant(end);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const da = displayDate(a, timeZone);
  const db = displayDate(b, timeZone);
  return daysBetween(da, db) * MINUTES_PER_DAY + minutesOfDate(db) - minutesOfDate(da);
}

/** Column index clamped into the view; a view always has ≥ 1 column. */
const clampColumn = (view: DayColumns, col: number) =>
  Math.max(0, Math.min(view.days.length - 1, col));

/**
 * The instant at `minutes` past midnight in visible column `col`. Wall-clock arithmetic: the offset is
 * read off the result, so a spring-forward gap normalises forward. `1440` is midnight the next day.
 */
export function instantAt(
  view: DayColumns,
  col: number,
  minutes: number,
  timeZone?: string,
): Instant {
  const d = startOfLocalDay(view.days[clampColumn(view, col)]);
  d.setMinutes(d.getMinutes() + Math.round(minutes));
  return formatInstant(d, timeZone);
}

/** A `Date` as an offset-qualified instant. With `timeZone`, `d` is a proxy carrying that zone's wall clock. */
export function formatInstant(d: Date, timeZone?: string): Instant {
  if (timeZone) return formatInstantInZone(unzonedInstant(d, timeZone), timeZone);
  // getTimezoneOffset is minutes WEST of UTC
  const off = -d.getTimezoneOffset();
  const zone =
    off === 0
      ? "Z"
      : `${off < 0 ? "-" : "+"}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
  return (
    `${toDateOnlyString(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    zone
  );
}

/**
 * `minutes` wall-clock minutes after `start`. Commits build `end` this way rather than stepping from
 * column midnight twice, which would skip a spring-forward gap twice. Returns `start` if unparseable.
 */
export function instantPlus(start: Instant, minutes: number, timeZone?: string): Instant {
  const ms = parseInstant(start);
  if (Number.isNaN(ms)) return start;
  const d = displayDate(ms, timeZone);
  d.setMinutes(d.getMinutes() + Math.round(minutes));
  return formatInstant(d, timeZone);
}

/** The date-only instant for visible column `col`. */
export function dateOnlyAt(view: DayColumns, col: number): Instant {
  return toDateOnlyString(view.days[clampColumn(view, col)]);
}

/**
 * The day AFTER column `col` — the exclusive all-day `end`. Not `dateOnlyAt(col + 1)`, which clamps
 * into the view and would collapse an event ending on the last column.
 */
export function dateOnlyAfter(view: DayColumns, col: number): Instant {
  return toDateOnlyString(addDays(view.days[clampColumn(view, col)], 1));
}
