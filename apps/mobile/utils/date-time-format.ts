/**
 * The app's one way to say when something happens, after the Bookings list: "Thu, 22 Oct" and
 * "7:00 PM - 8:00 PM". Times follow the user's 12h/24h setting (useHour12).
 *
 * Built from numbers rather than Intl's own date and time styles: Hermes and the browser lay
 * those out differently, and only the zone conversion needs Intl.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Between the two ends of a time or date range. */
export const RANGE_SEPARATOR = " - ";

/** A moment as a clock on the wall shows it; month is 1-12. */
export interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface DateTimeFormatOptions {
  /** IANA zone to show the moment in; the device's own when left out. */
  timeZone?: string;
  /** false for the 24-hour clock. */
  hour12?: boolean;
  /** Decides whether the year is shown: only when it isn't this one. */
  now?: Date;
}

function partsInZone(date: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Some engines write midnight as hour 24 with hour12 off.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** The wall clock reading of a moment in a zone, or on the device. */
export function toWallParts(date: Date, timeZone?: string): WallParts {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
  try {
    return partsInZone(date, timeZone);
  } catch {
    // An unknown IANA zone on this device: fall back to UTC rather than crash the row.
    return partsInZone(date, "UTC");
  }
}

/** "2026-10-20T08:00" (a wall time) as parts. */
export function parseWallTime(wallTime: string): WallParts {
  const [date = "", time = ""] = wallTime.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
}

/** "Thu, 22 Oct", or "Thu, 22 Oct 2027" with the year. */
export function formatWallDate(parts: WallParts, withYear: boolean): string {
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  const date = `${weekday}, ${parts.day} ${MONTHS[parts.month - 1]}`;
  return withYear ? `${date} ${parts.year}` : date;
}

/** "7:00 PM", or "19:00" on the 24-hour clock. */
export function formatWallClock(parts: WallParts, hour12 = true): string {
  const minute = String(parts.minute).padStart(2, "0");
  if (!hour12) return `${String(parts.hour).padStart(2, "0")}:${minute}`;
  const hour = parts.hour % 12 || 12;
  return `${hour}:${minute} ${parts.hour < 12 ? "AM" : "PM"}`;
}

/** "Thu, 22 Oct" for a moment, in a zone or on the device; the year only when it isn't this one. */
export function formatDate(date: Date | string, options: DateTimeFormatOptions = {}): string {
  const { timeZone, now = new Date() } = options;
  const parts = toWallParts(new Date(date), timeZone);
  return formatWallDate(parts, parts.year !== toWallParts(now, timeZone).year);
}

/** "7:00 PM" (or "19:00") for a moment, in a zone or on the device. */
export function formatTime(date: Date | string, options: DateTimeFormatOptions = {}): string {
  return formatWallClock(toWallParts(new Date(date), options.timeZone), options.hour12);
}

/** "7:00 PM - 8:00 PM" */
export function formatTimeRange(
  start: Date | string,
  end: Date | string,
  options: DateTimeFormatOptions = {}
): string {
  return `${formatTime(start, options)}${RANGE_SEPARATOR}${formatTime(end, options)}`;
}

/** "Tue, 20 Oct · 8:00 AM" for a wall time such as "2026-10-20T08:00". */
export function formatWallDateTime(
  wallTime: string,
  options: { hour12?: boolean; now?: Date } = {}
): string {
  const parts = parseWallTime(wallTime);
  const withYear = parts.year !== (options.now ?? new Date()).getFullYear();
  return `${formatWallDate(parts, withYear)} · ${formatWallClock(parts, options.hour12)}`;
}
