/**
 * Wall-clock times for Cal Events, ported from the web app's `apps/web/modules/events/lib/wall-time.ts`.
 *
 * An event is entered as a wall-clock reading (`"2026-08-01T18:00"`) plus an explicit IANA
 * timezone, and the API stores the resolved UTC instant. A wall-time string is a bare calendar
 * reading: "+1 hour" on it means 17:46 -> 18:46 whatever the device's or the event's zone, so the
 * arithmetic below runs on the string's face values in UTC, the one clock with no offset or DST.
 * The web uses dayjs; the app has no date library, so conversion goes through `Intl`.
 */

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** A start can drift a little into the past between the form and the server (same slack as the API). */
export const CAL_EVENT_START_PAST_TOLERANCE_MS = 60_000;

export function isStartTimeInPast(startTime: Date, now: Date = new Date()): boolean {
  return startTime.getTime() < now.getTime() - CAL_EVENT_START_PAST_TOLERANCE_MS;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The wall time's face values as if it were UTC, e.g. "2026-08-01T18:00" -> Date.UTC(2026, 7, 1, 18). */
function faceValueMs(wallTime: string): number {
  const match = WALL_TIME.exec(wallTime);
  if (!match) return Number.NaN;
  const [, year, month, day, hours, minutes] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
}

function faceValueToWallTime(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** How far `timeZone`'s clock is ahead of UTC at `instant`, in ms (negative west of Greenwich). */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  // Some engines print midnight as hour 24 under hour12: false.
  const hour = parts.hour === 24 ? 0 : parts.hour;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/** Interprets `wallTime` as a reading of `timeZone`'s clock and returns that instant. */
export function wallTimeToUtc(wallTime: string, timeZone: string): Date {
  const face = faceValueMs(wallTime);
  if (Number.isNaN(face)) return new Date(Number.NaN);
  const firstGuess = face - timeZoneOffsetMs(new Date(face), timeZone);
  // Near a DST change the offset at the guess can differ from the one at the face value.
  const offset = timeZoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(face - offset);
}

/** The reading of `timeZone`'s clock at `instant`, as `"YYYY-MM-DDTHH:mm"`. */
export function utcToWallTime(instant: Date, timeZone: string): string {
  return faceValueToWallTime(instant.getTime() + timeZoneOffsetMs(instant, timeZone));
}

/** Rounds `from` up to the next whole hour in `timeZone` (07:00 and 07:20 both give 08:00). */
export function nextHourWallTime(from: Date, timeZone: string): string {
  const face = faceValueMs(utcToWallTime(from, timeZone)) + HOUR_MS;
  return faceValueToWallTime(face - (face % HOUR_MS));
}

export function addHoursToWallTime(wallTime: string, hours: number): string {
  return addMillisecondsToWallTime(wallTime, hours * HOUR_MS);
}

export function addMillisecondsToWallTime(wallTime: string, ms: number): string {
  return faceValueToWallTime(faceValueMs(wallTime) + ms);
}

/** `to` − `from`, in wall-clock terms. */
export function wallTimeDiffMs(from: string, to: string): number {
  return faceValueMs(to) - faceValueMs(from);
}

export function isSameWallDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function splitWallTimeParts(wallTime: string): { date: string; timeOfDay: string } {
  const [date, timeOfDay = "00:00"] = wallTime.split("T");
  return { date, timeOfDay: timeOfDay.slice(0, 5) };
}

/** Start of today in `timeZone`: the earliest day a start can be picked on. */
export function todayStartWallTime(timeZone: string, now: Date = new Date()): string {
  return `${utcToWallTime(now, timeZone).slice(0, 10)}T00:00`;
}

/**
 * A device-local `Date` showing the wall time's face values, for the iOS picker, which can only
 * show the device's zone. It is not the event's instant: `wallTimeToUtc` resolves that once the
 * event's zone is known. A face value in the device's own spring-forward gap comes back an hour
 * later, so prefer `wallTimeToUtcFaceDate` for a picker that takes a timezone.
 */
export function wallTimeToCalendarDate(wallTime: string): Date {
  const match = WALL_TIME.exec(wallTime);
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hours, minutes] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
}

/** The face values of a picker's device-local `Date`, back as a wall time. */
export function calendarDateToWallTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * The wall time's face values as a UTC `Date`, for a picker told to show UTC. UTC has no DST, so
 * every wall time, including one the device's own clock skips, shows exactly as written.
 */
export function wallTimeToUtcFaceDate(wallTime: string): Date {
  return new Date(faceValueMs(wallTime));
}

/** The UTC face values of a picker's `Date`, back as a wall time. */
export function utcFaceDateToWallTime(date: Date): string {
  return faceValueToWallTime(date.getTime());
}

/**
 * Keeps the picked wall times when the timezone changes. If that start is already past in the new
 * zone, it moves to the zone's next whole hour and keeps the duration.
 */
export function preserveWallTimeOnTimezoneChange(
  startWallTime: string,
  endWallTime: string,
  timeZone: string,
  now: Date = new Date()
): { startWallTime: string; endWallTime: string } {
  if (!isStartTimeInPast(wallTimeToUtc(startWallTime, timeZone), now)) {
    return { startWallTime, endWallTime };
  }
  const durationMs = wallTimeDiffMs(startWallTime, endWallTime);
  const nextStart = nextHourWallTime(now, timeZone);
  return {
    startWallTime: nextStart,
    endWallTime: addMillisecondsToWallTime(nextStart, durationMs),
  };
}

/** "GMT+02:00" and "Madrid", for the timezone chip. */
export function timeZoneSummary(
  timeZone: string,
  at: Date = new Date()
): { offset: string; city: string } {
  const offsetMinutes = Math.round(timeZoneOffsetMs(at, timeZone) / MINUTE_MS);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return {
    offset: `GMT${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`,
    city: (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " "),
  };
}

/** The device's IANA timezone, or UTC when the engine can't tell. */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
