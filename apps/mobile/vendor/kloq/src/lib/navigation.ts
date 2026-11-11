/** navigation — stepping and naming the visible range. Month/year anchors are normalised to the 1st. */

import {
  AGENDA_DAYS,
  addDays,
  daysBetween,
  type KloqView,
  startOfLocalDay,
  type ViewDescriptor,
  viewKind,
} from "./calendar-types";

/** `-1` is back, `1` is forward — no zero step. */
export type StepDirection = -1 | 1;

/** The anchor date one step of `view` away from `date`; a fresh local-midnight `Date`. */
export function stepAnchor(view: KloqView, date: Date, dir: StepDirection, n?: number): Date {
  const kind = viewKind(view);
  const from = startOfLocalDay(date);
  switch (kind) {
    case "day":
      return addDays(from, dir);
    case "timeline":
      return addDays(from, dir);
    case "week":
      return addDays(from, dir * 7);
    case "agenda":
      return addDays(from, dir * AGENDA_DAYS);
    case "month":
      return new Date(from.getFullYear(), from.getMonth() + dir, 1);
    case "year":
      return new Date(from.getFullYear() + dir, 0, 1);
    case "days": {
      const width = Math.max(1, Math.round(n ?? (view as number)));
      return addDays(from, dir * width);
    }
  }
}

/** The anchor a view should sit on to show today (the 1st for month/year). */
export function todayAnchor(view: KloqView, now: Date = new Date()): Date {
  const today = startOfLocalDay(now);
  const kind = viewKind(view);
  if (kind === "month") return new Date(today.getFullYear(), today.getMonth(), 1);
  if (kind === "year") return new Date(today.getFullYear(), 0, 1);
  return today;
}

/** The visible range: `[start, end)`, end being midnight after the last column. */
export function rangeOfView(view: Pick<ViewDescriptor, "days">): {
  start: Date;
  end: Date;
} {
  const days = view.days;
  if (!days.length) {
    const now = startOfLocalDay(new Date());
    return { start: now, end: now };
  }
  return {
    start: startOfLocalDay(days[0]),
    end: addDays(startOfLocalDay(days[days.length - 1]), 1),
  };
}

const monthYear = (d: Date, locale?: string) =>
  d.toLocaleDateString(locale ?? "en-US", { month: "long", year: "numeric" });

/** The top-bar title: `February 2026`, `Feb – Mar 2026`, `Dec 2025 – Jan 2026`, or `2026`. */
export function formatViewTitle(
  view: Pick<ViewDescriptor, "kind" | "days" | "month" | "year">,
  locale?: string,
  opts: { short?: boolean } = {},
): string {
  const l = locale ?? "en-US";
  const days = view.days;
  const short = opts.short === true;
  const my = (d: Date) =>
    short ? d.toLocaleDateString(l, { month: "short", year: "numeric" }) : monthYear(d, l);
  if (view.kind === "year" && view.year)
    return view.year.toLocaleDateString(l, { year: "numeric" });
  if (!days.length) return "";
  if (view.kind === "month" && view.month) return my(view.month);
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length === 1)
    return short
      ? first.toLocaleDateString(l, { weekday: "short", month: "short", day: "numeric" })
      : first.toLocaleDateString(l, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
  if (first.getFullYear() === last.getFullYear()) {
    if (first.getMonth() === last.getMonth()) return my(first);
    const a = first.toLocaleDateString(l, { month: "short" });
    const b = last.toLocaleDateString(l, { month: "short" });
    return `${a} – ${b} ${last.getFullYear()}`;
  }
  const a = first.toLocaleDateString(l, { month: "short", year: "numeric" });
  const b = last.toLocaleDateString(l, { month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

/** "Previous week" / "Next month" — the accessible name on the ‹ › buttons. */
export function stepLabel(view: KloqView, dir: StepDirection): string {
  const kind = viewKind(view);
  const unit =
    kind === "days"
      ? `${Math.max(1, Math.round(view as number))} days`
      : kind === "agenda"
        ? `${AGENDA_DAYS} days`
        : kind;
  return `${dir < 0 ? "Previous" : "Next"} ${unit}`;
}

// ISO 8601 weeks: Monday-start, week 1 holds the first Thursday; independent of `weekStartsOn`
function isoThursday(d: Date): Date {
  const out = startOfLocalDay(d);
  // Sunday is 0 from `getDay()` but day 7 in ISO terms
  const iso = out.getDay() === 0 ? 7 : out.getDay();
  return addDays(out, 4 - iso);
}

/** The ISO 8601 week number of `d`, 1–53. */
export function isoWeek(d: Date): number {
  const thursday = isoThursday(d);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  // counted in calendar days, not ms, so a DST changeover can't shave a week off
  return Math.floor(daysBetween(jan1, thursday) / 7) + 1;
}

/** The ISO week-numbering year of `d` — differs from `getFullYear()` at year edges. */
export function isoWeekYear(d: Date): number {
  return isoThursday(d).getFullYear();
}

/** `<Kloq navigationKeys>`: `←`/`→` step by the visible range or by one day. PageUp/Down always page. */
export type NavigationKeys = "range" | "day";
