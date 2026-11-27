/** Time helpers for the seed: wall-clock times in a named time zone, without a date library. */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The zone's UTC offset in minutes at `instant` (e.g. -240 for New York in summer). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - instant.getTime()) / MINUTE);
}

/** The calendar date (in `timeZone`) of `instant`, as YYYY-MM-DD. */
export function zonedDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * The instant that reads `hour:minute` on the day `dayOffset` days from `now`'s date, in
 * `timeZone`. Handles DST by re-checking the offset at the result.
 */
export function zonedTime(
  now: Date,
  dayOffset: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const [year, month, day] = zonedDate(now, timeZone).split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day + dayOffset, hour, minute);
  let instant = wallClock - zoneOffsetMinutes(new Date(wallClock), timeZone) * MINUTE;
  instant = wallClock - zoneOffsetMinutes(new Date(instant), timeZone) * MINUTE;
  return new Date(instant);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** ISO string without milliseconds, the way API v2 prints booking times. */
export function iso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}
