import {
  addDays,
  type CalEventPatch,
  type EventColor,
  formatInstant,
  isDateOnly,
  normalizeReminders,
  parseInstant,
  parseRRule,
  type Reminder,
  type RRuleEnd,
  type RRuleFreq,
  type RRuleParts,
  type RRuleWeekday,
  serializeRRule,
  startOfLocalDay,
  toDateOnlyString,
  untilFromDate,
  untilToDate,
  weekdayCodeOf,
  withEnd,
} from "../model.ts";
import type { EditTarget } from "../use-kloq.ts";

/** The editor's working copy. All-day `end` is the last day, inclusive (the store's is exclusive). */
export interface EventDraft {
  title: string;
  allDay: boolean;
  start: Date;
  end: Date;
  calendarId?: string;
  color?: EventColor;
  location: string;
  description: string;
  /** `null` = does not repeat */
  rrule: string | null;
  reminders: Reminder[];
}

const HOUR = 60 * 60_000;

export function draftFor(target: EditTarget, defaultCalendarId?: string): EventDraft {
  if (target.kind === "new") {
    return {
      title: target.title ?? "",
      allDay: target.allDay,
      start: target.start,
      end: target.allDay ? startOfLocalDay(target.start) : target.end,
      calendarId: target.calendarId ?? defaultCalendarId,
      location: target.location ?? "",
      description: "",
      rrule: null,
      reminders: [],
    };
  }
  const { event, occurrence } = target;
  const startIso = occurrence?.start ?? event.start;
  const endIso = occurrence?.end ?? event.end;
  const start = new Date(parseInstant(startIso));
  let end = new Date(parseInstant(endIso));
  if (event.allDay) {
    // exclusive end → the last day shown
    if (isDateOnly(endIso)) end = addDays(end, -1);
    if (end < start) end = start;
  }
  return {
    title: event.title,
    allDay: event.allDay === true,
    start,
    end,
    calendarId: event.calendarId,
    color: event.color,
    location: event.location ?? "",
    description: event.description ?? "",
    rrule: event.rrule ?? null,
    reminders: normalizeReminders(event.reminders),
  };
}

/** Moving the start drags the end along, keeping the length. */
export function withStart(draft: EventDraft, start: Date): EventDraft {
  const length = draft.end.getTime() - draft.start.getTime();
  return { ...draft, start, end: new Date(start.getTime() + Math.max(0, length)) };
}

/** The end never precedes the start. */
export function withEndDate(draft: EventDraft, end: Date): EventDraft {
  if (end.getTime() >= draft.start.getTime()) return { ...draft, end };
  return draft.allDay
    ? { ...draft, end: draft.start }
    : { ...draft, end: new Date(draft.start.getTime() + HOUR) };
}

export function withAllDay(draft: EventDraft, allDay: boolean): EventDraft {
  if (allDay === draft.allDay) return draft;
  if (allDay) {
    return {
      ...draft,
      allDay,
      start: startOfLocalDay(draft.start),
      end: startOfLocalDay(draft.end),
    };
  }
  const start = startOfLocalDay(draft.start);
  start.setHours(9);
  return { ...draft, allDay, start, end: new Date(start.getTime() + HOUR) };
}

/** The store patch for a draft (the whole event, for a new one). */
export function patchFor(draft: EventDraft): CalEventPatch {
  const when = draft.allDay
    ? {
        allDay: true as const,
        start: toDateOnlyString(draft.start),
        end: toDateOnlyString(addDays(startOfLocalDay(draft.end), 1)),
      }
    : { allDay: false as const, start: formatInstant(draft.start), end: formatInstant(draft.end) };
  return {
    title: draft.title.trim(),
    ...when,
    calendarId: draft.calendarId,
    location: draft.location.trim() || undefined,
    description: draft.description.trim() || undefined,
    rrule: draft.rrule ?? undefined,
    reminders: normalizeReminders(draft.reminders),
  };
}

// ── custom recurrence ───────────────────────────────────────────────────────

/** The custom builder's fields, read from (and written back to) an RRULE. */
export interface CustomRule {
  freq: RRuleFreq;
  interval: number;
  byDay: RRuleWeekday[];
  end: RRuleEnd["type"];
  until: Date;
  count: number;
}

function endOf(parts: RRuleParts): RRuleEnd {
  if (parts.count !== undefined) return { type: "count", count: parts.count };
  if (parts.until) return { type: "until", until: parts.until };
  return { type: "never" };
}

export function customFrom(rrule: string | null, start: Date): CustomRule {
  const parts = rrule ? parseRRule(rrule) : null;
  const end: RRuleEnd = parts ? endOf(parts) : { type: "never" };
  const days = parts?.byDay?.filter((d) => !d.ordinal).map((d) => d.weekday) ?? [];
  return {
    freq: parts?.freq ?? "WEEKLY",
    interval: parts?.interval ?? 1,
    byDay: days.length ? days : [weekdayCodeOf(start)],
    end: end.type,
    until: end.type === "until" ? untilToDate(end.until) : addDays(start, 30),
    count: end.type === "count" ? end.count : 10,
  };
}

export function ruleFrom(custom: CustomRule, start: Date): string {
  let parts: RRuleParts = { freq: custom.freq };
  if (custom.interval > 1) parts.interval = custom.interval;
  if (custom.freq === "WEEKLY") {
    const days = custom.byDay.length ? custom.byDay : [weekdayCodeOf(start)];
    parts.byDay = days.map((weekday) => ({ weekday }));
  }
  if (custom.end === "until") {
    parts = withEnd(parts, { type: "until", until: untilFromDate(custom.until) });
  } else if (custom.end === "count") {
    parts = withEnd(parts, { type: "count", count: Math.max(1, custom.count) });
  }
  return serializeRRule(parts);
}
