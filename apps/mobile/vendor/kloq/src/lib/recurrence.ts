/**
 * Recurrence: expands an `RRULE` into occurrences and turns a "this / following / all" answer into
 * a plan of store ops. Pure; every loop is bounded; all arithmetic is wall-clock, never elapsed ms.
 */

import {
  addDays,
  asPlacementId,
  type CalEvent,
  type CalEventPatch,
  formatInstant,
  type Instant,
  instantPlus,
  type PlacementId,
  parseInstant,
  type StoreId,
  toDateOnlyString,
  wallMinutesBetween,
} from "./calendar-types";
import { daysInMonth, MINUTES_PER_DAY, MS_PER_DAY } from "./date-math";
import { randomId } from "./ids";
import {
  parseRRule,
  type RRuleParts,
  type RRuleWeekday,
  serializeRRule,
  untilFromDate,
  untilToDate,
  WEEKDAY_CODES,
} from "./rrule";

/** `exdates`: excluded occurrence starts; `recurrenceId`: the occurrence a detached event replaces. */
export interface RecurrenceFields {
  exdates?: Instant[];
  recurrenceId?: Instant;
}

/** A store event that may carry the recurrence fields above. */
export type RecurringEvent = CalEvent & RecurrenceFields;

/** Half-open window `[start, end)` an expansion is asked about. */
interface DateRange {
  start: Date;
  end: Date;
}

/** One materialised instance of a series. */
export interface Occurrence {
  start: Instant;
  /** `start` + the master's wall-clock duration */
  end: Instant;
  /** 0-based ordinal within the whole series */
  index: number;
  isFirst: boolean;
}

interface ExpandOptions {
  /** max occurrences returned */
  limit?: number;
  /** max candidate periods walked */
  maxIterations?: number;
}

export interface Expansion {
  occurrences: Occurrence[];
  /** a bound was hit; `occurrences` is a prefix of the real answer */
  truncated: boolean;
}

/** The expansion seam. Must return every occurrence whose `[start, end)` OVERLAPS `range`, not just starts inside. */
export type ExpandRecurrenceFn = (
  event: CalEvent,
  range: DateRange,
  opts?: ExpandOptions,
) => Expansion;

export const DEFAULT_OCCURRENCE_LIMIT = 1000;
/** Expansion always counts from `DTSTART` (`COUNT` is ordinal); this stops a series anchored in 1970 from spinning. */
export const DEFAULT_MAX_ITERATIONS = 10_000;

// Placement ids: `${masterId}#${occurrenceStart}` for an instance, `…@${segment}` for a day-slice.
const KEY_SEP = "#";
const INSTANT_TAIL = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))?$/;

// `@` is not a character `formatInstant` can emit, so it never collides with the occurrence half.
const SEG_SEP = "@";

/** `("ev-1", "2026-02-11T09:00:00Z")` → `"ev-1#2026-02-11T09:00:00Z"`. */
export const occurrenceKey = (id: string, start?: Instant | null): PlacementId =>
  asPlacementId(start ? `${id}${KEY_SEP}${start}` : id);

/** `(key, 0, 2)` → `` `${key}@0` ``; a single-segment placement keeps `key` unchanged. */
export const segmentKey = (key: string, index: number, count: number): PlacementId =>
  asPlacementId(count > 1 ? `${key}${SEG_SEP}${index}` : key);

/** The segment index encoded in a placement key, or `null` for an unsplit one. */
export function segmentIndexOf(key: string): number | null {
  const at = key.lastIndexOf(SEG_SEP);
  if (at <= 0) return null;
  const tail = key.slice(at + 1);
  if (!/^\d+$/.test(tail)) return null;
  return Number(tail);
}

/** A placement key with any segment suffix removed. */
export function withoutSegment(key: string): string {
  const at = key.lastIndexOf(SEG_SEP);
  return at > 0 && segmentIndexOf(key) !== null ? key.slice(0, at) : key;
}

/** Does this string carry an occurrence suffix? */
export function isOccurrenceKey(key: string): boolean {
  return occurrenceStartOf(key) !== null;
}

/** The occurrence start encoded in a placement key, or `null`. Splits on the LAST `#` so ids containing `#` work. */
export function occurrenceStartOf(key: string): Instant | null {
  const base = withoutSegment(key);
  const at = base.lastIndexOf(KEY_SEP);
  if (at <= 0) return null;
  const candidate = base.slice(at + 1);
  // the exact shapes the package writes — never Date.parse, which takes "5", "2024" and "Mar 5"
  if (!INSTANT_TAIL.test(candidate)) return null;
  return Number.isNaN(parseInstant(candidate)) ? null : candidate;
}

/** The STORE id behind a placement key. */
export function masterIdOf(key: PlacementId | string): string {
  const base = withoutSegment(key);
  const at = base.lastIndexOf(KEY_SEP);
  if (at <= 0) return base;
  return occurrenceStartOf(base) === null ? base : base.slice(0, at);
}

/** Every registered node belonging to a store id. */
export function nodesFor<T>(registry: Map<string, T>, id: string): T[] {
  return entriesFor(registry, id).map(([, node]) => node);
}

/** As {@link nodesFor}, but keeping each node's placement id. */
export function entriesFor<T>(registry: Map<string, T>, id: string): [PlacementId, T][] {
  const exact = registry.get(id);
  if (exact !== undefined) return [[asPlacementId(id), exact]];
  const out: [PlacementId, T][] = [];
  for (const [key, node] of registry) {
    if (masterIdOf(key) === id) out.push([asPlacementId(key), node]);
  }
  return out;
}

/** The first node for a store id. */
export function nodeFor<T>(registry: Map<string, T>, id: string): T | undefined {
  return nodesFor(registry, id)[0];
}

/** The excluded occurrence starts on an event. Always an array. */
export const exdatesOf = (event: CalEvent): Instant[] => (event as RecurringEvent).exdates ?? [];

/** Is this event a detached override of one occurrence of a series? */
export const recurrenceIdOf = (event: CalEvent): Instant | undefined =>
  (event as RecurringEvent).recurrenceId;

let engine: ExpandRecurrenceFn | null = null;

/** Substitute the expansion engine process-wide; `null` restores the built-in. */
export function registerRecurrenceEngine(fn: ExpandRecurrenceFn | null): void {
  engine = fn;
}

/** The registered engine, or the built-in {@link expandRecurrence}. */
export function getRecurrenceEngine(): ExpandRecurrenceFn {
  return engine ?? expandRecurrence;
}

const weekdayIndexOf = (code: RRuleWeekday) => WEEKDAY_CODES.indexOf(code);

const localDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

function daysOfWeekday(y: number, m: number, weekday: number): number[] {
  const len = daysInMonth(y, m);
  const first = localDate(y, m, 1).getDay();
  const out: number[] = [];
  for (let d = 1 + ((weekday - first + 7) % 7); d <= len; d += 7) out.push(d);
  return out;
}

function applySetPos<T>(items: T[], setPos: readonly number[] | undefined): T[] {
  if (!setPos?.length) return items;
  const out: T[] = [];
  for (const pos of setPos) {
    const i = pos > 0 ? pos - 1 : items.length + pos;
    if (i >= 0 && i < items.length && !out.includes(items[i])) out.push(items[i]);
  }
  return out.sort((a, b) => items.indexOf(a) - items.indexOf(b));
}

/** Can the built-in engine expand this rule faithfully? False for anything on `RRuleParts.extra`. */
export function canExpand(rule: string | RRuleParts | null | undefined): boolean {
  if (rule === null || rule === undefined || rule === "") return false;
  const parts = typeof rule === "string" ? parseRRule(rule) : rule;
  if (!parts) return false;
  return !parts.extra?.length;
}

interface Anchor {
  allDay: boolean;
  date: Date;
  hour: number;
  minute: number;
  second: number;
  durationMin: number;
}

function anchorOf(event: CalEvent, startMs: number): Anchor {
  const date = new Date(startMs);
  const allDay = event.allDay === true;
  return {
    allDay,
    date,
    hour: allDay ? 0 : date.getHours(),
    minute: allDay ? 0 : date.getMinutes(),
    second: allDay ? 0 : date.getSeconds(),
    durationMin: Math.max(allDay ? MINUTES_PER_DAY : 0, wallMinutesBetween(event.start, event.end)),
  };
}

// Start is built from calendar fields so 9am stays 9am across DST; end steps from that start.
function materialise(anchor: Anchor, day: Date): { start: Instant; end: Instant } {
  if (anchor.allDay) {
    const start = toDateOnlyString(day);
    const days = Math.max(1, Math.round(anchor.durationMin / MINUTES_PER_DAY));
    return { start, end: toDateOnlyString(addDays(day, days)) };
  }
  const start = formatInstant(
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      anchor.hour,
      anchor.minute,
      anchor.second,
      0,
    ),
  );
  return { start, end: instantPlus(start, anchor.durationMin) };
}

function candidatesFor(
  parts: RRuleParts,
  anchor: Anchor,
  cursor: { y: number; m: number; d: number },
): Date[] {
  const byDay = parts.byDay ?? [];
  const byMonthDay = parts.byMonthDay ?? [];
  const byMonth = parts.byMonth;

  const withinMonth = (y: number, m: number): number[] => {
    const len = daysInMonth(y, m);
    const days = new Set<number>();
    if (byMonthDay.length) {
      for (const md of byMonthDay) {
        const d = md > 0 ? md : len + md + 1;
        // RFC 5545 §3.3.10: invalid dates are ignored, not clamped
        if (d >= 1 && d <= len) days.add(d);
      }
    } else if (byDay.length) {
      for (const entry of byDay) {
        const all = daysOfWeekday(y, m, weekdayIndexOf(entry.weekday));
        if (entry.ordinal === undefined) {
          for (const d of all) days.add(d);
          continue;
        }
        const i = entry.ordinal > 0 ? entry.ordinal - 1 : all.length + entry.ordinal;
        if (i >= 0 && i < all.length) days.add(all[i]);
      }
    } else {
      const d = anchor.date.getDate();
      if (d <= len) days.add(d);
    }
    return [...days].sort((a, b) => a - b);
  };

  const inMonth = (d: Date) => !byMonth?.length || byMonth.includes(d.getMonth() + 1);

  switch (parts.freq) {
    case "DAILY": {
      const day = localDate(cursor.y, cursor.m, cursor.d);
      if (!inMonth(day)) return [];
      if (byDay.length && !byDay.some((b) => weekdayIndexOf(b.weekday) === day.getDay())) return [];
      if (byMonthDay.length) {
        const len = daysInMonth(cursor.y, cursor.m);
        const ok = byMonthDay.some((md) => (md > 0 ? md : len + md + 1) === day.getDate());
        if (!ok) return [];
      }
      return [day];
    }
    case "WEEKLY": {
      const weekStart = localDate(cursor.y, cursor.m, cursor.d);
      const offsets = byDay.length
        ? byDay.map((b) => (weekdayIndexOf(b.weekday) - weekStart.getDay() + 7) % 7)
        : [0];
      return [...new Set(offsets)]
        .sort((a, b) => a - b)
        .map((o) => addDays(weekStart, o))
        .filter(inMonth);
    }
    case "MONTHLY": {
      if (byMonth?.length && !byMonth.includes(cursor.m)) return [];
      return withinMonth(cursor.y, cursor.m).map((d) => localDate(cursor.y, cursor.m, d));
    }
    case "YEARLY": {
      const months = byMonth?.length ? [...byMonth].sort((a, b) => a - b) : [cursor.m];
      const out: Date[] = [];
      for (const m of months) {
        for (const d of withinMonth(cursor.y, m)) out.push(localDate(cursor.y, m, d));
      }
      return out.sort((a, b) => a.getTime() - b.getTime());
    }
  }
}

function periodStart(parts: RRuleParts, anchor: Anchor): { y: number; m: number; d: number } {
  const d = anchor.date;
  if (parts.freq === "WEEKLY") {
    // weekly intervals are counted in WKST-aligned weeks
    const wkst = weekdayIndexOf(parts.wkst ?? "MO");
    const back = (d.getDay() - wkst + 7) % 7;
    const start = addDays(d, -back);
    return { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() };
  }
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function advance(
  parts: RRuleParts,
  cursor: { y: number; m: number; d: number },
  interval: number,
): { y: number; m: number; d: number } {
  switch (parts.freq) {
    case "DAILY":
    case "WEEKLY": {
      const step = parts.freq === "DAILY" ? interval : interval * 7;
      const next = addDays(localDate(cursor.y, cursor.m, cursor.d), step);
      return { y: next.getFullYear(), m: next.getMonth() + 1, d: next.getDate() };
    }
    case "MONTHLY": {
      const total = cursor.y * 12 + (cursor.m - 1) + interval;
      return { y: Math.floor(total / 12), m: (total % 12) + 1, d: 1 };
    }
    case "YEARLY":
      return { y: cursor.y + interval, m: cursor.m, d: 1 };
  }
}

const overlaps = (start: Instant, end: Instant, range: DateRange) => {
  const s = parseInstant(start);
  const e = parseInstant(end);
  return e > range.start.getTime() && s < range.end.getTime();
};

/**
 * Every occurrence of `event` overlapping `range`. An event with no expandable rule expands to itself.
 * Excluded occurrences still consume an ordinal, so `COUNT` counts the series (RFC 5545 §3.8.5.1).
 */
export function expandRecurrence(
  event: CalEvent,
  range: DateRange,
  opts: ExpandOptions = {},
): Expansion {
  const limit = opts.limit ?? DEFAULT_OCCURRENCE_LIMIT;
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const startMs = parseInstant(event.start);
  if (Number.isNaN(startMs)) return { occurrences: [], truncated: false };

  const parts = event.rrule ? parseRRule(event.rrule) : null;
  const single: Occurrence = {
    start: event.start,
    end: event.end,
    index: 0,
    isFirst: true,
  };
  if (!parts || !canExpand(parts)) {
    return {
      occurrences: overlaps(event.start, event.end, range) ? [single] : [],
      truncated: false,
    };
  }

  const anchor = anchorOf(event, startMs);
  const interval = Math.max(1, parts.interval ?? 1);
  const untilMs = parts.until ? untilToDate(parts.until).getTime() : null;
  // exclusions match exactly as written and by calendar day
  const skip = new Set<string>();
  for (const x of exdatesOf(event)) {
    skip.add(x);
    skip.add(dayKeyOf(x));
  }

  const occurrences: Occurrence[] = [];
  let cursor = periodStart(parts, anchor);
  let index = 0;
  let iterations = 0;
  let truncated = false;

  outer: while (iterations < maxIterations) {
    iterations += 1;
    const periodMs = localDate(cursor.y, cursor.m, cursor.d).getTime();
    // without this a COUNT-less rule never terminates
    if (periodMs > range.end.getTime()) break;

    for (const day of periodDays(parts, anchor, cursor)) {
      const { start, end } = materialise(anchor, day);
      const ms = parseInstant(start);
      // no occurrence precedes DTSTART
      if (ms < startMs) continue;
      if (untilMs !== null && ms > untilMs) break outer;
      if (parts.count !== undefined && index >= parts.count) break outer;

      const ordinal = index;
      index += 1;
      if (skip.has(start) || skip.has(dayKeyOf(start))) continue;
      if (!overlaps(start, end, range)) continue;
      occurrences.push({ start, end, index: ordinal, isFirst: ordinal === 0 });
      if (occurrences.length >= limit) {
        truncated = true;
        break outer;
      }
    }

    cursor = advance(parts, cursor, interval);
  }
  if (iterations >= maxIterations) truncated = true;

  return { occurrences, truncated };
}

const dayKeyOf = (instant: Instant): string => {
  const ms = parseInstant(instant);
  return Number.isNaN(ms) ? instant : toDateOnlyString(new Date(ms));
};

const periodDays = (
  parts: RRuleParts,
  anchor: Anchor,
  cursor: { y: number; m: number; d: number },
) => applySetPos(candidatesFor(parts, anchor, cursor), parts.bySetPos);

// widening lookahead windows, in days
const LOOKAHEAD_DAYS = [40, 400, 4000, 40_000];

/** The occurrence at exactly `start`, or `null` if the series has none there. */
export function occurrenceAt(event: CalEvent, start: Instant): Occurrence | null {
  const ms = parseInstant(start);
  if (Number.isNaN(ms)) return null;
  const { occurrences } = getRecurrenceEngine()(event, {
    start: new Date(ms),
    end: new Date(ms + 1),
  });
  return occurrences.find((o) => o.start === start) ?? occurrences[0] ?? null;
}

/** The next occurrence strictly after `from`, or `null` at the end of a series. */
export function nextOccurrence(event: CalEvent, from: Instant): Occurrence | null {
  const ms = parseInstant(from);
  if (Number.isNaN(ms)) return null;
  const expand = getRecurrenceEngine();
  for (const days of LOOKAHEAD_DAYS) {
    const { occurrences, truncated } = expand(event, {
      start: new Date(ms + 1),
      end: new Date(ms + days * MS_PER_DAY),
    });
    const hit = occurrences.find((o) => parseInstant(o.start) > ms);
    if (hit) return hit;
    if (truncated) return null;
  }
  return null;
}

/** The occurrence immediately before `before`, or `null` at the start. */
export function previousOccurrence(event: CalEvent, before: Instant): Occurrence | null {
  const ms = parseInstant(before);
  if (Number.isNaN(ms)) return null;
  const startMs = parseInstant(event.start);
  if (Number.isNaN(startMs) || startMs >= ms) return null;
  const { occurrences } = getRecurrenceEngine()(event, {
    start: new Date(startMs),
    end: new Date(ms),
  });
  for (let i = occurrences.length - 1; i >= 0; i -= 1) {
    if (parseInstant(occurrences[i].start) < ms) return occurrences[i];
  }
  return null;
}

export type RecurrenceScope = "this" | "following" | "all";

export const RECURRENCE_SCOPES: readonly RecurrenceScope[] = ["this", "following", "all"];

/** One store operation; a plan is a list of these, applied through the ordinary commit path. */
type RecurrenceOp =
  | { type: "add"; event: RecurringEvent }
  | { type: "update"; id: StoreId; patch: CalEventPatch & RecurrenceFields }
  | { type: "remove"; id: StoreId };

export interface RecurrencePlan {
  ops: RecurrenceOp[];
  /** the event to select afterwards, if not the master */
  selectId?: string;
}

interface ScopeOptions {
  /** id factory for the detached / split event */
  makeId?: () => string;
}

/** The minimum of `KloqStore` a plan needs. */
export interface PlanTarget {
  add(event: CalEvent): void;
  update(id: StoreId, patch: CalEventPatch): void;
  remove(id: StoreId): void;
  /** Atomic form. A controlled store computes each op from the same stale
      `events` array, so a plan applied op-by-op loses all but its last op. */
  batch?(ops: readonly PlanOp[]): void;
}

export type PlanOp =
  | { type: "add"; event: CalEvent }
  | { type: "update"; id: StoreId; patch: CalEventPatch }
  | { type: "remove"; id: StoreId };

/** Run a plan against a store — as one batch wherever the store can. */
export function applyPlan(target: PlanTarget, plan: RecurrencePlan): void {
  if (target.batch) {
    target.batch(plan.ops as PlanOp[]);
    return;
  }
  for (const op of plan.ops) {
    if (op.type === "add") target.add(op.event as CalEvent);
    else if (op.type === "update") target.update(op.id, op.patch as CalEventPatch);
    else target.remove(op.id);
  }
}

const defaultMakeId = () => randomId("ev");

function shifted(allDay: boolean, instant: Instant, minutes: number): Instant {
  if (!allDay) return instantPlus(instant, minutes);
  const ms = parseInstant(instant);
  if (Number.isNaN(ms)) return instant;
  return toDateOnlyString(addDays(new Date(ms), Math.round(minutes / MINUTES_PER_DAY)));
}

function endFrom(allDay: boolean, start: Instant, minutes: number): Instant {
  if (!allDay) return instantPlus(start, minutes);
  const ms = parseInstant(start);
  if (Number.isNaN(ms)) return start;
  return toDateOnlyString(
    addDays(new Date(ms), Math.max(1, Math.round(minutes / MINUTES_PER_DAY))),
  );
}

function untilBefore(allDay: boolean, start: Instant): RRuleParts["until"] {
  const ms = parseInstant(start);
  if (allDay) return untilFromDate(addDays(new Date(ms), -1));
  // one second earlier in local wall-clock fields; `untilToDate` reads them floating
  return untilFromDate(new Date(ms - 1000), { withTime: true, utc: false });
}

// `COUNT` is split rather than converted to `UNTIL`, so the total number of meetings is unchanged.
function trimRule(
  master: CalEvent,
  parts: RRuleParts,
  occurrence: Occurrence,
): { head: string; tail: string } {
  if (parts.count !== undefined) {
    const head = { ...parts, count: Math.max(1, occurrence.index) };
    const tail = { ...parts, count: Math.max(1, parts.count - occurrence.index) };
    return { head: serializeRRule(head), tail: serializeRRule(tail) };
  }
  const head: RRuleParts = { ...parts };
  delete head.count;
  head.until = untilBefore(master.allDay === true, occurrence.start);
  return { head: serializeRRule(head), tail: serializeRRule(parts) };
}

function splitExdates(master: CalEvent, at: Instant) {
  const ms = parseInstant(at);
  const all = exdatesOf(master);
  return {
    head: all.filter((x) => parseInstant(x) < ms),
    tail: all.filter((x) => parseInstant(x) >= ms),
  };
}

const orUndefined = <T>(list: T[]) => (list.length ? list : undefined);

/**
 * Delete one occurrence (`EXDATE` on the master), the tail (`UNTIL` / reduced `COUNT`), or the whole
 * series. Deleting "following" from the first occurrence removes the master.
 */
export function deleteOccurrence(
  master: CalEvent,
  occurrence: Occurrence,
  scope: RecurrenceScope,
): RecurrencePlan {
  const parts = master.rrule ? parseRRule(master.rrule) : null;
  if (!parts || scope === "all" || (scope === "following" && occurrence.isFirst)) {
    return { ops: [{ type: "remove", id: master.id }] };
  }

  if (scope === "this") {
    const exdates = [...exdatesOf(master), occurrence.start];
    return { ops: [{ type: "update", id: master.id, patch: { exdates } }] };
  }

  const { head } = trimRule(master, parts, occurrence);
  const exdates = splitExdates(master, occurrence.start).head;
  return {
    ops: [
      {
        type: "update",
        id: master.id,
        patch: { rrule: head, exdates: orUndefined(exdates) },
      },
    ],
  };
}

/**
 * Edit one occurrence (detach with `recurrenceId` + `EXDATE`), the tail (split into a new master), or
 * the whole series. A `patch.start` on `"all"` becomes a wall-clock SHIFT of the master.
 */
export function editOccurrence(
  master: CalEvent,
  occurrence: Occurrence,
  patch: CalEventPatch & RecurrenceFields,
  scope: RecurrenceScope,
  opts: ScopeOptions = {},
): RecurrencePlan {
  const parts = master.rrule ? parseRRule(master.rrule) : null;
  const allDay = (patch.allDay ?? master.allDay) === true;

  if (!parts || scope === "all" || (scope === "following" && occurrence.isFirst)) {
    return { ops: [{ type: "update", id: master.id, patch: shiftAll(master, occurrence, patch) }] };
  }

  const makeId = opts.makeId ?? defaultMakeId;
  const start = patch.start ?? occurrence.start;
  const end =
    patch.end ?? endFrom(allDay, start, wallMinutesBetween(occurrence.start, occurrence.end));

  if (scope === "this") {
    const id = makeId();
    const detached = {
      ...master,
      ...patch,
      id,
      start,
      end,
      rrule: undefined,
      exdates: undefined,
      recurrenceId: occurrence.start,
    } as RecurringEvent;
    return {
      ops: [
        {
          type: "update",
          id: master.id,
          patch: { exdates: [...exdatesOf(master), occurrence.start] },
        },
        { type: "add", event: detached },
      ],
      selectId: id,
    };
  }

  const id = makeId();
  const { head, tail } = trimRule(master, parts, occurrence);
  const exdates = splitExdates(master, occurrence.start);
  const next = {
    ...master,
    ...patch,
    id,
    start,
    end,
    rrule: tail,
    exdates: orUndefined(exdates.tail),
  } as RecurringEvent;
  return {
    ops: [
      {
        type: "update",
        id: master.id,
        patch: { rrule: head, exdates: orUndefined(exdates.head) },
      },
      { type: "add", event: next },
    ],
    selectId: id,
  };
}

function shiftAll(
  master: CalEvent,
  occurrence: Occurrence,
  patch: CalEventPatch & RecurrenceFields,
): CalEventPatch & RecurrenceFields {
  if (patch.start === undefined) return patch;
  const allDay = (patch.allDay ?? master.allDay) === true;
  const delta = wallMinutesBetween(occurrence.start, patch.start);
  const duration =
    patch.end !== undefined
      ? wallMinutesBetween(patch.start, patch.end)
      : wallMinutesBetween(master.start, master.end);
  const start = shifted(allDay, master.start, delta);
  return { ...patch, start, end: endFrom(allDay, start, duration) };
}
