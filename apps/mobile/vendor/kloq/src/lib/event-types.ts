/** The stored event model. */

import { type Instant, parseInstant } from "./instant";
import type { TimeFormatOptions } from "./time-format";
import { describeAuthoredZone, isForeignZone } from "./timezone";

/** RSVP state for an invitee. Absent is treated as "pending". */
export type AttendeeStatus = "accepted" | "declined" | "tentative" | "pending";

/** One invitee. `email` is the identity (dedupe key, ICS `mailto:` value). */
export interface Attendee {
  email: string;
  name?: string;
  status?: AttendeeStatus;
  /** RFC 5545 `ROLE=OPT-PARTICIPANT` */
  optional?: boolean;
}

/** Palette keys, not hexes — every event is tinted through the theme table. */
export type EventColor = "blue" | "violet" | "emerald" | "amber" | "rose";

/** Fallback colour when neither the event nor its calendar names one. */
export const DEFAULT_EVENT_COLOR: EventColor = "blue";

/** How a reminder wants to reach you. The component never delivers either — see {@link Reminder}. */
export type ReminderMethod = "popup" | "email";

/**
 * One alert on an event. `minutesBefore` > 0 is before, 0 at start, < 0 after (RFC 5545 TRIGGER, sign flipped).
 * Data only: nothing here schedules or fires; hosts use `nextReminderAt` (`lib/reminders.ts`).
 */
export interface Reminder {
  minutesBefore: number;
  method?: ReminderMethod;
}

/** Everything a stored event carries except *when* it is — see `CalEvent`. */
interface CalEventCore {
  id: string;
  title: string;
  description?: string;
  /** Optional on purpose: absent falls back to the calendar's colour (`resolveEventColor`). */
  color?: EventColor;

  /** free-text place */
  location?: string;
  /** video-call link */
  meetingUrl?: string;
  /** invitees in insertion order; `email` is the dedupe key */
  attendees?: Attendee[];
  /** RFC 5545 `ORGANIZER` as a bare address; independent of the attendee list */
  organizer?: string;
  /** alerts as offsets from start; canonicalised by `normalizeReminders` */
  reminders?: Reminder[];
  /** free/busy; absent means busy */
  busy?: boolean;
  /** cannot be edited, moved, resized or deleted from this UI */
  readOnly?: boolean;
  /** source calendar id */
  calendarId?: string;
  /** RFC 5545 `RRULE` value without the `RRULE:` prefix; parsed by `lib/rrule.ts` */
  rrule?: string;
  /** occurrence starts excluded from `rrule` — RFC 5545 `EXDATE` */
  exdates?: Instant[];
  /** detached occurrence: start of the series instance this replaces — RFC 5545 `RECURRENCE-ID` */
  recurrenceId?: Instant;
  /**
   * IANA zone the wall-clock time was authored in. Provenance only — `start`/`end` decide placement.
   * Set on authoring and left alone by drags; shown only when it differs from the display zone.
   */
  timeZone?: string;
}

/** A timed event: two offset-qualified instants, `"2026-08-07T09:00:00+01:00"`. */
export interface TimedCalEvent extends CalEventCore {
  allDay?: false;
  start: Instant;
  end: Instant;
}

/**
 * An all-day event: two date-only instants. `end` is EXCLUSIVE (RFC 5545 date-only `DTEND`);
 * the inclusive conversion lives only in `dateOnlyAfter` and the projection.
 */
export interface AllDayCalEvent extends CalEventCore {
  allDay: true;
  start: Instant;
  end: Instant;
}

/** A stored event, discriminated on `allDay`. */
export type CalEvent = TimedCalEvent | AllDayCalEvent;

/** A partial update. Deliberately loose (collapses the union) so it can express "make this all-day". */
export type CalEventPatch = Partial<Omit<CalEvent, "id">>;

/** Busy unless explicitly marked free — absent `busy` is busy. */
export const isBusy = (e: Pick<CalEvent, "busy">) => e.busy !== false;

/** The shape the zone helpers need — a `CalEvent` or a `PlacedEvent.source`. */
type ZonedEvent = Pick<CalEvent, "start" | "end" | "timeZone" | "allDay">;

/** Does the authored zone disagree with the display zone? All-day events never qualify. */
export function hasForeignZone(e: ZonedEvent, displayZone: string): boolean {
  return !e.allDay && isForeignZone(e.timeZone, displayZone);
}

/** `"9:00 AM – 10:00 AM GMT+1 · London"`, or `""` when there is nothing to say. */
export function eventZoneNote(
  e: ZonedEvent,
  displayZone: string,
  opts: TimeFormatOptions = {},
): string {
  if (e.allDay) return "";
  return describeAuthoredZone(
    parseInstant(e.start),
    parseInstant(e.end),
    e.timeZone,
    displayZone,
    opts,
  );
}
