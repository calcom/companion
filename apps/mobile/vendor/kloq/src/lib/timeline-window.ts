/**
 * The timeline's visible span. One continuous window rather than a day: 30-min
 * slots across a working day for room booking, day slots across a fortnight for
 * a roster, and later week slots across a quarter for a Gantt. The only thing
 * that changes between them is the divisor.
 */

import { createVerticalAxis, type KloqAxis } from "./axis";
import { clampZoom, ZOOM_STEPS } from "./density";
import { startOfLocalDay } from "./instant";

export interface TimelineWindow {
  start: Date;
  end: Date;
  /** the snap and tick unit, in minutes */
  slotMinutes: number;
  /** px per slot, before zoom */
  pxPerSlot: number;
}

/**
 * What a host passes for `timelineWindow`. Two modes, same as the calendar's
 * `date` vs. its uncontrolled anchor:
 *
 *  - CONTROLLED — pass both `start` and `end`: honoured exactly, and
 *    `resolveWindow` never recomputes them. Navigation (`stepAnchor` on a
 *    `"timeline"` view) still moves the calendar's own anchor date, but
 *    nothing rebinds this window to it — moving the visible span is then the
 *    host's job, typically by deriving a new `start`/`end` from its own
 *    `onDateChange` and passing it back in.
 *  - DERIVED (the default — omit `start`/`end`) — the window is computed off
 *    the view's anchor date: `start` = the anchor's local midnight plus
 *    `startOffsetMinutes`, `end` = `start` plus `spanMinutes`. This is what
 *    makes `stepAnchor`/next-prev move the window with no extra wiring.
 *
 * `start`/`end` are all-or-nothing: passing only one of them still derives
 * off the anchor (as if neither were passed), same as `slotMinutes`/`pxPerSlot`
 * falling back independently.
 */
export interface TimelineWindowConfig {
  start?: Date;
  end?: Date;
  /** the snap and tick unit, in minutes */
  slotMinutes?: number;
  /** px per slot, before zoom */
  pxPerSlot?: number;
  /** derived mode only: minutes after the anchor's local midnight the window starts. Default 480 (8:00 AM). */
  startOffsetMinutes?: number;
  /** derived mode only: the window's length, in minutes. Default 600 (a 10-hour day, 8:00 AM – 6:00 PM). */
  spanMinutes?: number;
}

const MS_PER_MIN = 60_000;

const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_PX_PER_SLOT = 40;
/** 8:00 AM */
const DEFAULT_START_OFFSET_MINUTES = 8 * 60;
/** 8:00 AM – 6:00 PM */
const DEFAULT_SPAN_MINUTES = 10 * 60;

const num = (v: number | undefined, fallback: number, lo: number, hi: number) =>
  v === undefined || !Number.isFinite(v) ? fallback : Math.min(hi, Math.max(lo, v));

/**
 * Validate and normalise. Junk is clamped, never thrown on, matching how
 * `createSettings` treats a bad config: a backwards range becomes one slot
 * wide rather than an error.
 *
 * `anchor` is read only in derived mode (no explicit `start`/`end`) — it is
 * the calendar's own view anchor, so a `"timeline"` view's window tracks
 * `stepAnchor`/next-prev the same way every other view's visible range does.
 * Defaults to "now", matching every other uncontrolled default in this
 * package, so it is read fresh on every call rather than frozen at import time.
 */
export function resolveWindow(
  w: TimelineWindowConfig = {},
  anchor: Date = new Date(),
): TimelineWindow {
  const slotMinutes = num(w.slotMinutes, DEFAULT_SLOT_MINUTES, 1, 43_200);
  const pxPerSlot = num(w.pxPerSlot, DEFAULT_PX_PER_SLOT, 1, 2_000);

  let start: Date;
  let proposed: Date;
  if (w.start !== undefined && w.end !== undefined) {
    // controlled mode: both given, honoured exactly
    start = w.start;
    proposed = w.end;
  } else {
    // derived mode: a lone `start` or `end` is not enough to control the
    // window (there is nothing to pair it with), so it derives off the
    // anchor too, same as if neither were passed
    const offset = num(w.startOffsetMinutes, DEFAULT_START_OFFSET_MINUTES, 0, 1440);
    start = new Date(startOfLocalDay(anchor).getTime() + offset * MS_PER_MIN);
    const span = num(w.spanMinutes, DEFAULT_SPAN_MINUTES, slotMinutes, 1440 * 366);
    proposed = new Date(start.getTime() + span * MS_PER_MIN);
  }
  const end =
    proposed.getTime() > start.getTime()
      ? proposed
      : new Date(start.getTime() + slotMinutes * MS_PER_MIN);
  return { start, end, slotMinutes, pxPerSlot };
}

/**
 * Apply a zoom rung. The same ladder the calendar's hour height uses, applied
 * to px per slot: zoom changes how wide time is drawn, never how much of it is
 * shown. `w` is already a resolved window with concrete `start`/`end` (the
 * caller derives those off the anchor before zooming), so routing the scaled
 * result back through `resolveWindow` lands in its controlled branch — a
 * pure passthrough for `start`/`end` here, not a mode change — while still
 * getting `pxPerSlot`'s own clamping rules applied.
 */
export function zoomWindow(w: TimelineWindow, zoom: number): TimelineWindow {
  // INVARIANT this leans on: `w.start`/`w.end` are already consistent with
  // whatever anchor produced `w` (the caller re-derives on every anchor
  // change before this runs), so handing both to `resolveWindow` lands in
  // its controlled branch as a no-op passthrough, not a mode change — it
  // only re-clamps `pxPerSlot`/`slotMinutes` here. If `w` could ever be
  // stale relative to the anchor, this call would freeze it in place.
  return resolveWindow({ ...w, pxPerSlot: w.pxPerSlot * ZOOM_STEPS[clampZoom(zoom)] });
}

/** Minutes from the window's start to an instant. Negative before it. */
export const minutesFromStart = (w: TimelineWindow, at: Date | number): number =>
  ((typeof at === "number" ? at : at.getTime()) - w.start.getTime()) / MS_PER_MIN;

/** The instant a minute offset names. */
export const instantAtMinute = (w: TimelineWindow, min: number): Date =>
  new Date(w.start.getTime() + min * MS_PER_MIN);

/**
 * The timeline's axis: time runs across, and the origin is the window start —
 * so minute 0 is the left edge, not midnight.
 *
 * The arithmetic is identical to the vertical axis with a zero origin, so it
 * reuses that implementation rather than restating it, and overrides only the
 * orientation.
 */
export function createHorizontalAxis(w: TimelineWindow): KloqAxis {
  const totalMin = minutesFromStart(w, w.end);
  const perHour = (w.pxPerSlot / w.slotMinutes) * 60;
  const base = createVerticalAxis({
    hourHeight: perHour,
    dayStartMin: 0,
    dayEndMin: totalMin,
  });
  return { ...base, orientation: "x" };
}

export interface Tick {
  /** minutes from the window start */
  min: number;
  label: string;
  /** does this tick get the heavier rule and the upper-tier label? */
  major: boolean;
}

/**
 * One tick per slot. "Major" is the next unit up: hour boundaries on a
 * sub-hour window, day boundaries on a sub-day one, and every tick on a window
 * whose slot is already a day or larger.
 */
export function ticksOf(w: TimelineWindow, locale?: string): Tick[] {
  const total = minutesFromStart(w, w.end);
  const count = Math.ceil(total / w.slotMinutes);
  const majorEvery = w.slotMinutes < 60 ? 60 : w.slotMinutes < 1440 ? 1440 : w.slotMinutes;
  const l = locale ?? "en-US";
  const ticks: Tick[] = [];
  for (let i = 0; i < count; i += 1) {
    const min = i * w.slotMinutes;
    const at = instantAtMinute(w, min);
    const absolute = at.getHours() * 60 + at.getMinutes();
    const major =
      majorEvery >= 1440 ? absolute === 0 || w.slotMinutes >= 1440 : absolute % majorEvery === 0;
    ticks.push({
      min,
      major,
      label:
        w.slotMinutes >= 1440
          ? at.toLocaleDateString(l, { weekday: "short", day: "numeric" })
          : at.toLocaleTimeString(l, { hour: "numeric", minute: "2-digit" }),
    });
  }
  return ticks;
}

/** Minutes of the heavier rules: the same "major" `ticksOf` marks, without formatting a label per slot. */
export function majorRules(w: TimelineWindow): number[] {
  if (w.slotMinutes >= 1440) return [];
  const total = minutesFromStart(w, w.end);
  const count = Math.ceil(total / w.slotMinutes);
  const every = w.slotMinutes < 60 ? 60 : 1440;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = instantAtMinute(w, i * w.slotMinutes);
    if ((at.getHours() * 60 + at.getMinutes()) % every === 0) out.push(i * w.slotMinutes);
  }
  return out;
}

export interface AxisLabels {
  /** labelled ticks; `minuteOfDay` is the wall-clock minute, `at` the instant */
  ticks: { min: number; minuteOfDay: number; at: Date }[];
  /** one span per calendar day the window touches; empty when it stays inside one day */
  days: { startMin: number; endMin: number; at: Date }[];
  /** the slot is a day or longer, so `ticks` name dates rather than times */
  dated: boolean;
}

const LABEL_STRIDES = [15, 30, 60, 120, 180, 240, 360, 720, 1440];

/**
 * What the header prints. Ticks are labelled at the first stride that keeps
 * `minGapPx` between them; a window touching several days also gets a day tier.
 * `wallClock` maps an instant onto the display zone's clock (defaults to local).
 */
export function axisLabels(
  w: TimelineWindow,
  opts: { minGapPx?: number; wallClock?: (at: Date) => Date } = {},
): AxisLabels {
  const total = minutesFromStart(w, w.end);
  const count = Math.ceil(total / w.slotMinutes);
  const minGap = opts.minGapPx ?? 56;
  const wall = opts.wallClock ?? ((at: Date) => at);
  const pxPerMin = w.pxPerSlot / w.slotMinutes;
  const ticks: AxisLabels["ticks"] = [];

  if (w.slotMinutes >= 1440) {
    const every = Math.max(1, Math.ceil(minGap / w.pxPerSlot));
    for (let i = 0; i < count; i += every) {
      const at = instantAtMinute(w, i * w.slotMinutes);
      ticks.push({ min: i * w.slotMinutes, minuteOfDay: 0, at });
    }
    return { ticks, days: [], dated: true };
  }

  const stride =
    LABEL_STRIDES.find(
      (s) => s >= w.slotMinutes && s % w.slotMinutes === 0 && s * pxPerMin >= minGap,
    ) ?? 1440;
  const days: AxisLabels["days"] = [];
  let dayKey = "";
  for (let i = 0; i < count; i += 1) {
    const min = i * w.slotMinutes;
    const at = instantAtMinute(w, min);
    const clock = wall(at);
    const minuteOfDay = clock.getHours() * 60 + clock.getMinutes();
    const key = `${clock.getFullYear()}-${clock.getMonth()}-${clock.getDate()}`;
    if (key !== dayKey) {
      dayKey = key;
      // the day began `minuteOfDay` minutes before this slot, clipped to the window
      const startMin = Math.max(0, min - (i === 0 ? 0 : minuteOfDay));
      const prev = days[days.length - 1];
      if (prev) prev.endMin = startMin;
      days.push({ startMin, endMin: total, at });
    }
    if (minuteOfDay % stride === 0) ticks.push({ min, minuteOfDay, at });
  }
  return { ticks, days: days.length > 1 ? days : [], dated: false };
}

/**
 * The default-duration span a fresh booking gets, snapped to the window's
 * slot unit and clamped inside it. Pure window/minute math — `durationMin`
 * is the caller's own default-duration constant (the calendar's
 * `DEFAULT_QUICK_ADD_MIN`, typically), passed in rather than imported, so
 * this stays a `lib` module with no dependency on `calendar/`.
 */
export function defaultBookingSpan(
  window: TimelineWindow,
  rawStartMin: number,
  durationMin: number,
): { startMin: number; endMin: number } {
  const total = minutesFromStart(window, window.end);
  const snapped = Math.round(rawStartMin / window.slotMinutes) * window.slotMinutes;
  const startMin = Math.max(0, Math.min(total - durationMin, snapped));
  return { startMin, endMin: startMin + durationMin };
}
