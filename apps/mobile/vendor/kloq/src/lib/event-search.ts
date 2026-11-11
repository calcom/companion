/** Event search across the whole store; among equal text matches the one nearest `now` wins. */

import {
  addDays,
  type CalEvent,
  formatMinutes,
  isDateOnly,
  minutesOfDate,
  parseInstant,
} from "./calendar-types";
import { normalizeQuery } from "./command-model";
import { MS_PER_MINUTE, sameDay } from "./date-math";

export interface EventSearchResult {
  event: CalEvent;
  /** higher is better; only meaningful relative to other results */
  score: number;
  /** epoch ms of the event's start */
  start: number;
}

export interface EventSearchOptions {
  /** clock for the recency tie-break */
  now?: Date;
  /** max results; default 8 */
  limit?: number;
}

const FIELD_SCORE = {
  titleExact: 8,
  titlePrefix: 6,
  titleWord: 5,
  title: 4,
  location: 3,
  attendee: 2,
  description: 1,
} as const;

function scoreToken(event: CalEvent, token: string): number {
  const title = normalizeQuery(event.title ?? "");
  if (title) {
    if (title === token) return FIELD_SCORE.titleExact;
    if (title.startsWith(token)) return FIELD_SCORE.titlePrefix;
    if (title.split(" ").some((w) => w.startsWith(token))) return FIELD_SCORE.titleWord;
    if (title.includes(token)) return FIELD_SCORE.title;
  }
  if (normalizeQuery(event.location ?? "").includes(token)) return FIELD_SCORE.location;
  for (const a of event.attendees ?? []) {
    if (normalizeQuery(a.email).includes(token) || normalizeQuery(a.name ?? "").includes(token))
      return FIELD_SCORE.attendee;
  }
  if (normalizeQuery(event.description ?? "").includes(token)) return FIELD_SCORE.description;
  return 0;
}

/** Rank events against a query: every token must match (AND); ties break on distance from `now`, start, id. */
export function searchEvents(
  events: readonly CalEvent[],
  query: string,
  opts: EventSearchOptions = {},
): EventSearchResult[] {
  const tokens = normalizeQuery(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const nowMs = (opts.now ?? new Date()).getTime();
  const limit = opts.limit ?? 8;

  const hits: EventSearchResult[] = [];
  for (const event of events) {
    let score = 0;
    let matched = true;
    for (const token of tokens) {
      const s = scoreToken(event, token);
      if (s === 0) {
        matched = false;
        break;
      }
      score += s;
    }
    if (!matched) continue;
    const start = parseInstant(event.start);
    hits.push({ event, score, start: Number.isNaN(start) ? nowMs : start });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = Math.abs(a.start - nowMs);
    const db = Math.abs(b.start - nowMs);
    if (da !== db) return da - db;
    if (a.start !== b.start) return a.start - b.start;
    return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
  });

  return limit >= 0 ? hits.slice(0, limit) : hits;
}

/** `90` → `"1h 30m"`. */
export function formatDurationShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** "Fri, 8 Aug"; the year is shown only when it differs from `now`'s. */
export function formatDayLabel(date: Date, now: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * `"Fri, 8 Aug · 1:00 PM – 2:00 PM · 1h"` / `"Fri, 8 Aug · All day"`. For all-day input `end` is
 * the INCLUSIVE last day; convert a stored end with `allDayDisplayEnd()`.
 */
export function formatWhen(start: Date, end: Date, allDay: boolean, now: Date): string {
  const day = formatDayLabel(start, now);
  if (allDay) {
    return sameDay(start, end)
      ? `${day} · All day`
      : `${day} – ${formatDayLabel(end, now)} · All day`;
  }
  const startMin = minutesOfDate(start);
  const endMin = minutesOfDate(end);
  const durationMin = Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE);
  const crossesDay = !sameDay(start, end);
  const range = `${formatMinutes(startMin)} – ${formatMinutes(endMin)}${
    crossesDay ? ` (${formatDayLabel(end, now)})` : ""
  }`;
  return `${day} · ${range} · ${formatDurationShort(durationMin)}`;
}

/** The inclusive last day of an all-day event, from the store's exclusive end. */
export function allDayDisplayEnd(startMs: number, endMs: number): Date {
  const end = new Date(endMs);
  const back = addDays(end, -1);
  return back.getTime() < startMs ? new Date(startMs) : back;
}

/** `formatWhen` for a store event, handling the exclusive all-day end. */
export function formatEventWhen(event: CalEvent, now: Date): string {
  const startMs = parseInstant(event.start);
  const endMs = parseInstant(event.end);
  if (Number.isNaN(startMs)) return "";
  const allDay = event.allDay === true || isDateOnly(event.start);
  const start = new Date(startMs);
  if (allDay) {
    const end = Number.isNaN(endMs) ? start : allDayDisplayEnd(startMs, endMs);
    return formatWhen(start, end, true, now);
  }
  return formatWhen(start, Number.isNaN(endMs) ? start : new Date(endMs), false, now);
}
