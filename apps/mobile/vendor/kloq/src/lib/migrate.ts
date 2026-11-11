/**
 * Persisted-payload versioning. v1 is a bare week-relative `CalEvent[]`, mapped onto the
 * Monday-start week containing the migration date; v2 is `{ v: 2, events }`. Input is untrusted.
 */

import {
  type CalEvent,
  dateOnlyAfter,
  dateOnlyAt,
  instantAt,
  isDateOnly,
  parseInstant,
  resolveView,
} from "./calendar-types";

/** The current persisted payload version. */
export const PAYLOAD_VERSION = 2;

export interface PayloadV2 {
  v: 2;
  events: CalEvent[];
}

const COLORS = ["blue", "violet", "emerald", "amber", "rose"] as const;
type Color = (typeof COLORS)[number];

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

const color = (x: unknown): Color => (COLORS.includes(x as Color) ? (x as Color) : "blue");

/** Fields that survive a migration untouched, when they're the right shape. */
function carryOptional(raw: Record<string, unknown>): Partial<CalEvent> {
  const out: Record<string, unknown> = {};
  for (const k of ["description", "location", "meetingUrl", "calendarId", "timeZone"]) {
    if (typeof raw[k] === "string") out[k] = raw[k];
  }
  for (const k of ["busy", "readOnly"]) {
    if (typeof raw[k] === "boolean") out[k] = raw[k];
  }
  if (Array.isArray(raw.attendees)) {
    const kept = raw.attendees.filter((a) => isRecord(a) && typeof a.email === "string");
    if (kept.length) out.attendees = kept;
  }
  return out as Partial<CalEvent>;
}

/** Is this a usable v2 event? Id and both instants must be present and parseable. */
export function isV2Event(x: unknown): x is CalEvent {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string" || !x.id) return false;
  if (typeof x.start !== "string" || typeof x.end !== "string") return false;
  if (Number.isNaN(parseInstant(x.start))) return false;
  if (Number.isNaN(parseInstant(x.end))) return false;
  if (x.allDay !== undefined && typeof x.allDay !== "boolean") return false;
  if (x.allDay === true && !(isDateOnly(x.start) && isDateOnly(x.end))) return false;
  return true;
}

const normaliseV2 = (e: CalEvent): CalEvent =>
  ({
    ...e,
    title: typeof e.title === "string" ? e.title : "",
    color: color(e.color),
  }) as CalEvent;

/** Migrate a v1 payload onto the Monday-start week containing `now`; unrecognisable items are dropped. */
export function migrateV1(raw: unknown, now: Date = new Date()): CalEvent[] {
  if (!Array.isArray(raw)) return [];
  const week = resolveView("week", 1, now);
  const out: CalEvent[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || !item.id) continue;
    const day = num(item.dayIndex);
    if (day === null) continue;

    const base = {
      id: item.id,
      title: typeof item.title === "string" ? item.title : "",
      color: color(item.color),
      ...carryOptional(item),
    };

    if (item.allDay === true) {
      // v1 `endDayIndex` is INCLUSIVE; `dateOnlyAfter` supplies the exclusive end
      const endDay = Math.max(day, num(item.endDayIndex) ?? day);
      out.push({
        ...base,
        allDay: true,
        start: dateOnlyAt(week, day),
        end: dateOnlyAfter(week, endDay),
      });
      continue;
    }

    const startMin = num(item.startMin);
    const endMin = num(item.endMin);
    if (startMin === null || endMin === null) continue;
    out.push({
      ...base,
      start: instantAt(week, day, startMin),
      end: instantAt(week, day, endMin),
    });
  }
  return out;
}

export interface ReadResult {
  events: CalEvent[];
  /** true when the payload was v1 and the caller should write v2 back */
  migrated: boolean;
}

/** Read a v1 or v2 payload; `null` for anything else so the caller keeps its seeds. */
export function readPayload(raw: unknown, now: Date = new Date()): ReadResult | null {
  if (Array.isArray(raw)) {
    const events = migrateV1(raw, now);
    return totalLoss(raw.length, events.length) ? null : { events, migrated: true };
  }
  if (!isRecord(raw)) return null;
  if (raw.v !== PAYLOAD_VERSION) return null;
  if (!Array.isArray(raw.events)) return null;
  const events = raw.events.filter(isV2Event).map(normaliseV2);
  return totalLoss(raw.events.length, events.length) ? null : { events, migrated: false };
}

// a non-empty payload that validates to nothing is corruption: returning [] would overwrite it on save
const totalLoss = (before: number, after: number) => before > 0 && after === 0;
