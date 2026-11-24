/** Which days are on screen. */
import { sameDay } from "./date-math";
import { daysBetween, displayNow, startOfLocalDay } from "./instant";

export type KloqView = "week" | "day" | "month" | "agenda" | "year" | "timeline" | number;

/** A view's shape, independent of how many days it shows. `"days"` is the n-day view. */
export type KloqViewKind = "day" | "days" | "week" | "month" | "agenda" | "year" | "timeline";

/** n-day bounds; a 1-day n-view is just `"day"`. */
export const MIN_N_DAY_VIEW = 2;
export const MAX_N_DAY_VIEW = 14;

/** A month grid is always 6 rows of 7 for a stable height. */
export const MONTH_WEEKS = 6;
export const MONTH_DAYS = MONTH_WEEKS * 7;

/** Days per agenda page. */
export const AGENDA_DAYS = 30;

/** Months in a year view. */
export const YEAR_MONTHS = 12;

/** The shape of a view. `2` and `9` are both `"days"`; their `n` is `dayCount`. */
export function viewKind(view: KloqView): KloqViewKind {
  if (
    view === "week" ||
    view === "day" ||
    view === "month" ||
    view === "agenda" ||
    view === "year" ||
    view === "timeline"
  )
    return view;
  return "days";
}

/** Does this view draw the scrollable hour grid? */
export function isTimeGridView(view: KloqView | KloqViewKind): boolean {
  const kind = view === "days" ? "days" : viewKind(view as KloqView);
  return kind === "day" || kind === "days" || kind === "week";
}

export interface ViewDescriptor {
  /** the view's shape */
  kind: KloqViewKind;
  /** visible column count */
  dayCount: number;
  /** actual date per column, local midnight, consecutive */
  days: Date[];
  /** column showing today, or -1 */
  todayIndex: number;
  /** per-column labels derived from real dates */
  namesShort: string[];
  namesLong: string[];
  /** month views only: the 1st of the shown month (`days[0]` is week-aligned, so it can't be read off that) */
  month?: Date;
  /** year views only: 1 January of the shown year */
  year?: Date;
}

/** The part of a view the date helpers need. */
export interface DayColumns {
  days: Date[];
}

/** Back up to the `weekStartsOn`-aligned start of `d`'s week. Never mutates. */
export function startOfWeek(d: Date, weekStartsOn: number = 1): Date {
  const out = startOfLocalDay(d);
  out.setDate(out.getDate() - ((out.getDay() - weekStartsOn + 7) % 7));
  return out;
}

/**
 * Resolve a view into concrete columns (week 7, day 1, n-day 2–14, month 42 week-aligned, agenda 30, year 365/366).
 * `date` is read for its wall-clock Y/M/D and never zone-converted; `opts.timeZone` only decides `todayIndex`.
 */
export function resolveView(
  view: KloqView = "week",
  weekStartsOn: number = 1,
  date: Date = new Date(),
  opts?: { locale?: string; timeZone?: string },
): ViewDescriptor {
  const anchor = startOfLocalDay(date);
  const kind = viewKind(view);

  let start: Date;
  let count: number;
  let month: Date | undefined;
  let year: Date | undefined;
  if (kind === "year") {
    year = new Date(anchor.getFullYear(), 0, 1);
    start = year;
    count = daysBetween(year, new Date(anchor.getFullYear() + 1, 0, 1));
  } else if (kind === "week") {
    start = startOfWeek(anchor, weekStartsOn);
    count = 7;
  } else if (kind === "day") {
    start = anchor;
    count = 1;
  } else if (kind === "month") {
    month = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start = startOfWeek(month, weekStartsOn);
    count = MONTH_DAYS;
  } else if (kind === "agenda") {
    start = anchor;
    count = AGENDA_DAYS;
  } else if (kind === "timeline") {
    // the timeline owns its own window (`lib/timeline-window.ts`); `days`
    // here is never read, but must still resolve to something valid rather
    // than falling into the n-day branch below and reading `view` as a number.
    start = anchor;
    count = 1;
  } else {
    start = anchor;
    count = Math.max(MIN_N_DAY_VIEW, Math.min(MAX_N_DAY_VIEW, Math.round(view as number)));
  }

  const days: Date[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = displayNow(opts?.timeZone);

  return {
    kind,
    dayCount: count,
    days,
    month,
    year,
    todayIndex: days.findIndex((d) => sameDay(d, today)),
    namesShort: weekdayNames(days, opts?.locale, "short"),
    namesLong: weekdayNames(days, opts?.locale, "long"),
  };
}

// Memoised per weekday: a year view would otherwise make 730 Intl calls. The en-US default is load-bearing.
function weekdayNames(
  days: readonly Date[],
  locale: string | undefined,
  weekday: "short" | "long",
): string[] {
  const table = new Array<string | undefined>(7);
  return days.map((d) => {
    const i = d.getDay();
    return (table[i] ??= d.toLocaleDateString(locale ?? "en-US", { weekday }));
  });
}
