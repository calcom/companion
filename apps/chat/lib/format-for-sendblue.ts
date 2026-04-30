import type {
  CalcomBooking,
  CalcomEventType,
  CalcomSchedule,
  CalcomWebhookPayload,
} from "./calcom/types";
import { formatBookingTime } from "./calcom/webhooks";
import { formatAvailabilitySummary } from "./format-availability-summary";

const MAX_TEXT_LENGTH = 3_500;
const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

export function formatSlotLabel(time: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(time));
}

export function truncateForSendblue(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_TEXT_LENGTH - 32).trimEnd()}\n\n[truncated]`;
}

export function formatNumberedList<T>(
  items: T[],
  formatItem: (item: T, index: number) => string
): string {
  return items.map((item, index) => `${index + 1}. ${formatItem(item, index)}`).join("\n");
}

export function formatBookingsForSendblue(bookings: CalcomBooking[], timeZone: string): string {
  if (bookings.length === 0) return "You have no upcoming bookings.";

  const lines = bookings.slice(0, 10).map((booking, index) => {
    const attendees = booking.attendees
      .map((attendee) => attendee.name || attendee.email)
      .join(", ");
    const meeting = booking.meetingUrl ? `\n   Join: ${booking.meetingUrl}` : "";
    return `${index + 1}. ${booking.title}\n   ${formatBookingTime(
      booking.start,
      booking.end,
      timeZone
    )}\n   With: ${attendees || "No attendees"}${meeting}`;
  });

  const suffix = bookings.length > 10 ? `\n\nShowing 10 of ${bookings.length} bookings.` : "";
  return truncateForSendblue(`Upcoming bookings:\n\n${lines.join("\n\n")}${suffix}`);
}

export function formatEventTypesForSendblue(eventTypes: CalcomEventType[]): string {
  if (eventTypes.length === 0) return "You have no event types.";

  const body = formatNumberedList(eventTypes.slice(0, 20), (eventType) => {
    const hidden = eventType.hidden ? " hidden" : "";
    const url = eventType.bookingUrl ? ` - ${eventType.bookingUrl}` : "";
    return `${eventType.title} (${eventType.length} min${hidden})${url}`;
  });
  const suffix =
    eventTypes.length > 20 ? `\n\nShowing 20 of ${eventTypes.length} event types.` : "";
  return truncateForSendblue(`Your event types:\n\n${body}${suffix}`);
}

export function formatSchedulesForSendblue(schedules: CalcomSchedule[]): string {
  if (schedules.length === 0) return "You have no schedules.";

  const body = formatNumberedList(schedules.slice(0, 10), (schedule) => {
    const defaultLabel = schedule.isDefault ? " (default)" : "";
    return `${schedule.name}${defaultLabel}\n   Time zone: ${schedule.timeZone}\n   Hours: ${formatAvailabilitySummary(schedule.availability)}`;
  });
  const suffix = schedules.length > 10 ? `\n\nShowing 10 of ${schedules.length} schedules.` : "";
  return truncateForSendblue(`Your schedules:\n\n${body}${suffix}`);
}

export function formatCalcomWebhookForSendblue(webhook: CalcomWebhookPayload): string {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);
  const attendees = payload.attendees.map((attendee) => attendee.name || attendee.email).join(", ");
  const meetingUrl = payload.videoCallData?.url;

  const titleByEvent: Record<string, string> = {
    BOOKING_CREATED: "New booking",
    BOOKING_RESCHEDULED: "Booking rescheduled",
    BOOKING_CANCELLED: "Booking cancelled",
    BOOKING_CONFIRMED: "Booking confirmed",
    BOOKING_REMINDER: "Upcoming meeting reminder",
  };

  return truncateForSendblue(
    [
      titleByEvent[webhook.triggerEvent] ?? "Booking update",
      payload.title,
      `When: ${time}`,
      `With: ${attendees || "No attendees"}`,
      ...(payload.location ? [`Location: ${payload.location}`] : []),
      ...(payload.cancellationReason ? [`Reason: ${payload.cancellationReason}`] : []),
      ...(payload.rescheduleReason ? [`Reason: ${payload.rescheduleReason}`] : []),
      ...(meetingUrl ? [`Join: ${meetingUrl}`] : []),
      `View bookings: ${CALCOM_APP_URL}/bookings`,
    ].join("\n")
  );
}
