/**
 * The create screen's logic, ported from the web's create step
 * (`apps/web/modules/events/lib/{build-cal-event-create-input,parse-location-input,create-cal-event-defaults}.ts`
 * and `apps/web/modules/events/create-event/sentence-{schedule,segments}.ts`) so both surfaces
 * create the same event from the same sentence.
 */

import type { CreateCalEventInput } from "@/services/types/cal-events.types";
import { formatWallClock, parseWallTime } from "@/utils/date-time-format";
import {
  addHoursToWallTime,
  addMillisecondsToWallTime,
  isSameWallDay,
  isStartTimeInPast,
  nextHourWallTime,
  wallTimeDiffMs,
  wallTimeToUtc,
} from "@/utils/wall-time";

export interface CreateCalEventFormValues {
  name: string;
  startWallTime: string;
  endWallTime: string;
  timeZone: string;
  isPrivate: boolean;
  /** Free text: a URL becomes a meeting link, anything else a street address. */
  location: string;
  requiresApproval: boolean;
}

/** The API's limit on a title. */
export const CAL_EVENT_NAME_MAX_LENGTH = 255;

/** An end at least this far after the start, as on the web's end picker. */
export const CAL_EVENT_MIN_DURATION_MS = 15 * 60 * 1000;

/** Starts at the next whole hour in the event's zone and lasts an hour. */
export function buildCreateCalEventDefaults(
  timeZone: string,
  now: Date = new Date()
): CreateCalEventFormValues {
  const start = nextHourWallTime(now, timeZone);
  return {
    name: "",
    startWallTime: start,
    endWallTime: addHoursToWallTime(start, 1),
    timeZone,
    isPrivate: false,
    location: "",
    requiresApproval: false,
  };
}

const PROTOCOL = /^https?:\/\//i;
// A bare host like "zoom.us/j/123": no spaces, a dot, and a letters-only TLD.
const BARE_HOST = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]\S*)?$/i;
// What the web's URL.canParse adds for a link with a protocol: a host after it.
const LINK_HOST = /^https?:\/\/([^/?#:@\s]+)/i;

export type CreateCalEventLocation = NonNullable<CreateCalEventInput["locations"]>[number];

/** One free-text box for "where": a URL becomes a meeting link, anything else a street address. */
export function parseLocationInput(raw: string): CreateCalEventLocation | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/\s/.test(value) && (PROTOCOL.test(value) || BARE_HOST.test(value))) {
    const link = PROTOCOL.test(value) ? value : `https://${value}`;
    if (LINK_HOST.test(link)) return { type: "link", link };
  }
  return { type: "address", address: value };
}

/**
 * How the sentence shows the location: "at" before an address, "online on" before a link, which
 * shows only its host until the field is focused.
 */
export function sentenceLocationDisplay(
  raw: string,
  focused: boolean
): { prefix: "at" | "online on" | null; text: string } {
  const parsed = parseLocationInput(raw);
  if (parsed?.type === "link") {
    const host = (LINK_HOST.exec(parsed.link)?.[1] ?? parsed.link).replace(/^www\./i, "");
    return { prefix: "online on", text: focused ? raw : host };
  }
  if (parsed?.type === "address") return { prefix: "at", text: raw };
  return { prefix: null, text: raw };
}

export function isMultiDay(
  values: Pick<CreateCalEventFormValues, "startWallTime" | "endWallTime">
) {
  return !isSameWallDay(values.startWallTime, values.endWallTime);
}

/** A new start carries the end along, keeping the duration. */
export function moveStart(
  values: Pick<CreateCalEventFormValues, "startWallTime" | "endWallTime">,
  nextStart: string
): { startWallTime: string; endWallTime: string } {
  const durationMs = wallTimeDiffMs(values.startWallTime, values.endWallTime);
  return {
    startWallTime: nextStart,
    endWallTime: addMillisecondsToWallTime(nextStart, durationMs),
  };
}

/** The earliest end the end picker offers. */
export function minEndWallTime(startWallTime: string): string {
  return addMillisecondsToWallTime(startWallTime, CAL_EVENT_MIN_DURATION_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19 Oct at 7:00 AM", the sentence's start (and a multi-day end). */
export function formatSentenceDateTime(wallTime: string, hour12 = true): string {
  const parts = parseWallTime(wallTime);
  return `${parts.day} ${MONTHS[parts.month - 1]} at ${formatWallClock(parts, hour12)}`;
}

/** "7:00 AM", a wall time's time of day. */
export function formatWallTimeOfDay(wallTime: string, hour12 = true): string {
  return formatWallClock(parseWallTime(wallTime), hour12);
}

/** The sentence's end: only the time on the start's day, else the date too. */
export function formatSentenceEnd(
  values: Pick<CreateCalEventFormValues, "startWallTime" | "endWallTime">,
  hour12 = true
): string {
  return isMultiDay(values)
    ? formatSentenceDateTime(values.endWallTime, hour12)
    : formatWallTimeOfDay(values.endWallTime, hour12);
}

/** The web's messages: the name first, then a start that has passed. */
export function getCreateCalEventError(
  values: CreateCalEventFormValues,
  now: Date = new Date()
): string | null {
  if (!values.name.trim()) return "Required";
  if (isStartTimeInPast(wallTimeToUtc(values.startWallTime, values.timeZone), now)) {
    return "Start date must be in the future";
  }
  return null;
}

/** The API body for the sentence; the slug and category are left to the server. */
export function buildCreateCalEventInput(values: CreateCalEventFormValues): CreateCalEventInput {
  const location = parseLocationInput(values.location);
  return {
    title: values.name.trim(),
    startTime: wallTimeToUtc(values.startWallTime, values.timeZone).toISOString(),
    endTime: wallTimeToUtc(values.endWallTime, values.timeZone).toISOString(),
    timeZone: values.timeZone,
    visibility: values.isPrivate ? "UNLISTED" : "PUBLIC",
    requiresApproval: values.requiresApproval,
    ...(location ? { locations: [location] } : {}),
  };
}
