import type { CalEvent, KloqController } from "expo-kloq";
import type { Booking } from "@/services/calcom";
import { isCancelledOrRejectedBooking, isPendingBooking } from "./booking-cache";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The profile's week start ("Monday") as kloq's day index (0 = Sunday); Monday when unknown. */
export function weekStartIndex(weekStart: string | undefined): number {
  const index = WEEKDAYS.indexOf((weekStart ?? "").toLowerCase());
  return index === -1 ? 1 : index;
}

/**
 * The bookings request's `afterStart` and `beforeEnd` for the days a calendar view shows. The API
 * only returns bookings that start and end inside that range, so it reaches one day further on
 * each side: a booking across the first or last midnight still comes back, and kloq draws only
 * the part on the days shown.
 */
export function calendarRange(descriptor: Pick<KloqController["descriptor"], "days">): {
  afterStart: string;
  beforeEnd: string;
} {
  const first = descriptor.days[0] ?? new Date();
  const last = descriptor.days[descriptor.days.length - 1] ?? first;
  const start = new Date(first);
  start.setDate(start.getDate() - 1);
  const end = new Date(last);
  end.setDate(end.getDate() + 2);
  return { afterStart: start.toISOString(), beforeEnd: end.toISOString() };
}

/**
 * Bookings as read-only kloq events, keyed by booking uid. Cancelled and rejected bookings are
 * left out; unconfirmed ones are amber.
 */
export function bookingsToCalendarEvents(bookings: Booking[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const booking of bookings) {
    if (isCancelledOrRejectedBooking(booking)) continue;
    const start = booking.startTime || booking.start;
    const end = booking.endTime || booking.end;
    if (!start || !end) continue;
    events.push({
      id: booking.uid,
      title: booking.title,
      start,
      end,
      color: isPendingBooking(booking) ? "amber" : "blue",
      location: booking.location,
      meetingUrl: booking.meetingUrl,
      readOnly: true,
    });
  }
  return events;
}
