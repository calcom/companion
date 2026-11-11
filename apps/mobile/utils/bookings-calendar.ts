import type { CalEvent, KloqController } from "expo-kloq";
import type { Booking } from "@/services/calcom";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The profile's week start ("Monday") as kloq's day index (0 = Sunday); Monday when unknown. */
export function weekStartIndex(weekStart: string | undefined): number {
  const index = WEEKDAYS.indexOf((weekStart ?? "").toLowerCase());
  return index === -1 ? 1 : index;
}

/** The days a calendar view shows, as the bookings request's `afterStart` and `beforeEnd`. */
export function calendarRange(descriptor: Pick<KloqController["descriptor"], "days">): {
  afterStart: string;
  beforeEnd: string;
} {
  const first = descriptor.days[0] ?? new Date();
  const last = descriptor.days[descriptor.days.length - 1] ?? first;
  const end = new Date(last);
  end.setDate(end.getDate() + 1);
  return { afterStart: first.toISOString(), beforeEnd: end.toISOString() };
}

/**
 * Bookings as read-only kloq events, keyed by booking uid. Cancelled and rejected bookings are
 * left out; unconfirmed ones are amber.
 */
export function bookingsToCalendarEvents(bookings: Booking[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const booking of bookings) {
    if (booking.status === "cancelled" || booking.status === "rejected") continue;
    const start = booking.startTime || booking.start;
    const end = booking.endTime || booking.end;
    if (!start || !end) continue;
    events.push({
      id: booking.uid,
      title: booking.title,
      start,
      end,
      color: booking.status === "pending" ? "amber" : "blue",
      location: booking.location,
      meetingUrl: booking.meetingUrl,
      readOnly: true,
    });
  }
  return events;
}
