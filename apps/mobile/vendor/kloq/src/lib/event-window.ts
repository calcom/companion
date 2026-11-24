/**
 * Conservative pre-filter for `projectEvents`: two string compares of ISO
 * instants against "YYYY-MM-DD" bounds. May say "keep" wrongly, never "drop".
 */

import type { CalEvent, Instant } from "./calendar-types";
import { pad2 } from "./date-math";

/** Slack per end: must exceed the authored-offset vs display-zone gap (26h) plus the projection's own day. */
export const WINDOW_SLACK_DAYS = 2;

/** Half-open `[lo, hi)` bound pair, as `"YYYY-MM-DD"` day keys. */
interface EventWindow {
  /** first day an event may touch */
  lo: string;
  /** first day it may NOT touch — exclusive */
  hi: string;
}

const dayKey = (d: Date, offsetDays: number): string => {
  const out = new Date(d);
  out.setDate(out.getDate() + offsetDays);
  return `${out.getFullYear()}-${pad2(out.getMonth() + 1)}-${pad2(out.getDate())}`;
};

/** Window for a view over `first`..`last` (inclusive local days), widened by `slackDays`. */
export function eventWindow(
  first: Date,
  last: Date,
  slackDays: number = WINDOW_SLACK_DAYS,
): EventWindow {
  return {
    lo: dayKey(first, -slackDays),
    hi: dayKey(last, slackDays + 1),
  };
}

/** Does this instant sort lexicographically? Non-ISO strings like `"Aug 12, 2026"` do not. */
export function isSortableInstant(s: Instant): boolean {
  if (s.length < 10) return false;
  // unrolled charCodeAt, not regex: runs 100k times per projection at 50k events
  return (
    digit(s, 0) &&
    digit(s, 1) &&
    digit(s, 2) &&
    digit(s, 3) &&
    s.charCodeAt(4) === 45 /* - */ &&
    digit(s, 5) &&
    digit(s, 6) &&
    s.charCodeAt(7) === 45 &&
    digit(s, 8) &&
    digit(s, 9)
  );
}

const digit = (s: string, i: number): boolean => {
  const c = s.charCodeAt(i);
  return c >= 48 && c <= 57;
};

/**
 * Can a series reach `window` without expanding it? Only proves absence via
 * DTSTART and UNTIL; `COUNT` is not used since it would require walking the rule.
 */
export function seriesMayOverlapWindow(
  rrule: string,
  start: Instant,
  { lo, hi }: EventWindow,
): boolean {
  const sortable = isSortableInstant(start);
  // occurrences never precede DTSTART
  if (sortable && start >= hi) return false;

  // UNTIL guard only fires when the master's own start is also outside the window:
  // an unparseable rule degrades to a single occurrence at the master's start
  if (sortable && start < lo) {
    const at = rrule.indexOf("UNTIL=");
    if (at >= 0) {
      const v = rrule.slice(at + 6, at + 14);
      if (v.length === 8 && isAllDigits(v)) {
        const untilKey = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
        if (untilKey < lo) return false;
      }
    }
  }
  return true;
}

const isAllDigits = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) if (!digit(s, i)) return false;
  return true;
};

/** Could this event be drawn in `window`? `false` means the projection is guaranteed to drop it. */
export function mayOverlapWindow(
  e: Pick<CalEvent, "start" | "end"> & { rrule?: string },
  { lo, hi }: EventWindow,
): boolean {
  // series are the caller's job via `seriesMayOverlapWindow`
  if (e.rrule) return true;
  const { start, end } = e;
  if (!isSortableInstant(start) || !isSortableInstant(end)) return true;
  // a backwards event still covers its start day, so the later bound wins
  const latest = end > start ? end : start;
  if (latest < lo) return false;
  // `>=` because `hi` is exclusive and a date-only start can equal it exactly
  if (start >= hi) return false;
  return true;
}
