/**
 * Reminders: offsets stored on events, resolved to fire times by `nextReminderAt`.
 * No delivery — the host owns the timer / service worker / push channel.
 */

import { type CalEvent, isDateOnly, parseInstant, type Reminder } from "./calendar-types";
import { MINUTES_PER_DAY, MS_PER_MINUTE } from "./date-math";

export { MINUTES_PER_DAY };

const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_WEEK = 10080;

/** Four weeks either side. */
export const MAX_MINUTES_BEFORE = 4 * MINUTES_PER_WEEK;

/** How many alerts one event may carry. */
export const MAX_REMINDERS = 5;

export interface ReminderPreset {
  minutesBefore: number;
  label: string;
}

/** The offsets offered by one tap. */
export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  { minutesBefore: 0, label: "At time of event" },
  { minutesBefore: 5, label: "5 minutes before" },
  { minutesBefore: 10, label: "10 minutes before" },
  { minutesBefore: 15, label: "15 minutes before" },
  { minutesBefore: 30, label: "30 minutes before" },
  { minutesBefore: 60, label: "1 hour before" },
  { minutesBefore: MINUTES_PER_DAY, label: "1 day before" },
  { minutesBefore: MINUTES_PER_WEEK, label: "1 week before" },
];

/** What "Add reminder" adds. */
export const DEFAULT_REMINDER: Reminder = { minutesBefore: 10 };

/** Canonical form, or `null`: whole minutes inside ±`MAX_MINUTES_BEFORE`, default `method` dropped. */
export function normalizeReminder(r: Reminder | null | undefined): Reminder | null {
  if (!r || typeof r.minutesBefore !== "number") return null;
  if (!Number.isFinite(r.minutesBefore)) return null;
  const minutes = Math.round(r.minutesBefore);
  if (Math.abs(minutes) > MAX_MINUTES_BEFORE) return null;
  return r.method && r.method !== "popup"
    ? { minutesBefore: minutes, method: r.method }
    : { minutesBefore: minutes };
}

const reminderKey = (r: Reminder) => `${r.minutesBefore}:${r.method ?? "popup"}`;

/** Canonical list: normalised, deduped, sorted by `minutesBefore` ascending, capped at `MAX_REMINDERS`. */
export function normalizeReminders(list: readonly Reminder[] | undefined): Reminder[] {
  const seen = new Set<string>();
  const out: Reminder[] = [];
  for (const raw of list ?? []) {
    const r = normalizeReminder(raw);
    if (!r) continue;
    const key = reminderKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  out.sort(
    (a, b) =>
      a.minutesBefore - b.minutesBefore || (a.method ?? "popup").localeCompare(b.method ?? "popup"),
  );
  return out.slice(0, MAX_REMINDERS);
}

/** Add one reminder. `null` when nothing would change (invalid, duplicate, or full). */
export function addReminder(
  list: readonly Reminder[] | undefined,
  reminder: Reminder,
): Reminder[] | null {
  const r = normalizeReminder(reminder);
  if (!r) return null;
  const current = normalizeReminders(list);
  if (current.length >= MAX_REMINDERS) return null;
  if (current.some((x) => reminderKey(x) === reminderKey(r))) return null;
  return normalizeReminders([...current, r]);
}

/** Drop the reminder equal to `reminder` (offset + method). */
export function removeReminder(
  list: readonly Reminder[] | undefined,
  reminder: Reminder,
): Reminder[] {
  const r = normalizeReminder(reminder);
  const current = normalizeReminders(list);
  if (!r) return current;
  return current.filter((x) => reminderKey(x) !== reminderKey(r));
}

/** Replace the reminder at `index` of the canonical list. `null` when out of range or a collision. */
export function replaceReminder(
  list: readonly Reminder[] | undefined,
  index: number,
  next: Reminder,
): Reminder[] | null {
  const current = normalizeReminders(list);
  if (index < 0 || index >= current.length) return null;
  const r = normalizeReminder(next);
  if (!r) return null;
  if (reminderKey(current[index]) === reminderKey(r)) return null;
  if (current.some((x, i) => i !== index && reminderKey(x) === reminderKey(r))) return null;
  const copy = [...current];
  copy[index] = r;
  return normalizeReminders(copy);
}

export type ReminderUnit = "minutes" | "hours" | "days" | "weeks";

export const REMINDER_UNITS: readonly { unit: ReminderUnit; minutes: number }[] = [
  { unit: "minutes", minutes: 1 },
  { unit: "hours", minutes: MINUTES_PER_HOUR },
  { unit: "days", minutes: MINUTES_PER_DAY },
  { unit: "weeks", minutes: MINUTES_PER_WEEK },
];

/** The largest unit that divides `minutes` exactly; 90 minutes stays "90 minutes". */
export function splitReminderUnit(minutes: number): {
  amount: number;
  unit: ReminderUnit;
} {
  const abs = Math.abs(Math.round(minutes));
  let best = REMINDER_UNITS[0];
  for (const u of REMINDER_UNITS) {
    if (abs !== 0 && abs % u.minutes === 0) best = u;
  }
  return { amount: abs / best.minutes, unit: best.unit };
}

const singular: Record<ReminderUnit, string> = {
  minutes: "minute",
  hours: "hour",
  days: "day",
  weeks: "week",
};

/** "10 minutes", "1 hour", "2 weeks". */
export function formatReminderOffset(minutes: number): string {
  const { amount, unit } = splitReminderUnit(minutes);
  return `${amount} ${amount === 1 ? singular[unit] : unit}`;
}

interface DescribeReminderOptions {
  /** append " · email" for a non-default method */
  withMethod?: boolean;
}

/** "10 minutes before" / "At time of event" / "5 minutes after". */
export function describeReminder(reminder: Reminder, opts: DescribeReminderOptions = {}): string {
  const r = normalizeReminder(reminder) ?? { minutesBefore: 0 };
  const base =
    r.minutesBefore === 0
      ? "At time of event"
      : `${formatReminderOffset(r.minutesBefore)} ${r.minutesBefore > 0 ? "before" : "after"}`;
  return opts.withMethod && r.method === "email" ? `${base} · email` : base;
}

/** "10 minutes before", or "3 reminders" once there's more than one. */
export function describeReminders(
  list: readonly Reminder[] | undefined,
  opts: DescribeReminderOptions = {},
): string {
  const rs = normalizeReminders(list);
  if (rs.length === 0) return "No reminders";
  if (rs.length === 1) return describeReminder(rs[0], opts);
  return `${rs.length} reminders`;
}

/** "15" + "minutes" → 15. `null` for anything that isn't a whole positive amount inside the bound. */
export function parseReminderAmount(raw: string, unit: ReminderUnit): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const per = REMINDER_UNITS.find((u) => u.unit === unit)?.minutes ?? 1;
  const minutes = Number(trimmed) * per;
  if (minutes > MAX_MINUTES_BEFORE) return null;
  return minutes;
}

/** A reminder resolved against a specific event. */
export interface ReminderOccurrence {
  reminder: Reminder;
  /** epoch ms this reminder is due */
  at: number;
}

type RemindableEvent = Pick<CalEvent, "start"> & {
  reminders?: readonly Reminder[];
};

/** Epoch ms the event begins, or `NaN`. An all-day start resolves to LOCAL midnight. */
export function reminderBaseTime(event: RemindableEvent): number {
  return parseInstant(event.start);
}

/** Is the base an all-day (date-only) instant? */
export function isAllDayBase(event: RemindableEvent): boolean {
  return isDateOnly(event.start);
}

/** Every reminder on `event` as a real time, earliest first. `reminders` overrides the event's own list. */
export function reminderTimes(
  event: RemindableEvent,
  reminders: readonly Reminder[] | undefined = event.reminders,
): ReminderOccurrence[] {
  const base = reminderBaseTime(event);
  if (Number.isNaN(base)) return [];
  return normalizeReminders(reminders)
    .map((reminder) => ({
      reminder,
      at: base - reminder.minutesBefore * MS_PER_MINUTE,
    }))
    .sort((a, b) => a.at - b.at || a.reminder.minutesBefore - b.reminder.minutesBefore);
}

/** The next reminder due STRICTLY after `now`, or `null`. This is the delivery seam. */
export function nextReminderAt(
  event: RemindableEvent,
  reminders: readonly Reminder[] | undefined = event.reminders,
  now: Date | number = Date.now(),
): ReminderOccurrence | null {
  const t = typeof now === "number" ? now : now.getTime();
  for (const occ of reminderTimes(event, reminders)) {
    if (occ.at > t) return occ;
  }
  return null;
}

/** The next reminder due across a whole calendar. */
export function nextReminderAcross(
  events: readonly CalEvent[],
  now: Date | number = Date.now(),
  defaults?: readonly Reminder[],
): (ReminderOccurrence & { event: CalEvent }) | null {
  let best: (ReminderOccurrence & { event: CalEvent }) | null = null;
  for (const event of events) {
    const occ = nextReminderAt(event, event.reminders ?? defaults, now);
    if (occ && (!best || occ.at < best.at)) best = { ...occ, event };
  }
  return best;
}
