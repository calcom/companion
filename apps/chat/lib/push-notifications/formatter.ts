// Mirrors ChatPushPayload from calcom/cal PR #2927
// packages/features/notifications/send-chat-push-notification.ts

import type { ChatElement } from "chat";
import { Actions, Card, Divider, Field, Fields, LinkButton } from "chat";

export type ChatPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType: string;
  hosts: Array<{ name: string; email: string }>;
  attendees: Array<{ name: string; email: string }>;
  start: string;
  end: string;
  timeZone: string;
  location?: string;
  meetingUrl?: string;
  cancellationReason?: string;
};

const NOTIFICATION_BADGES: Record<string, string> = {
  BOOKING_CONFIRMED: "✅ Booking Confirmed",
  BOOKING_CANCELLED: "❌ Booking Cancelled",
  BOOKING_RESCHEDULED: "🔄 Booking Rescheduled",
  BOOKING_REQUESTED: "🕐 Booking Requested",
  BOOKING_REJECTED: "🚫 Booking Rejected",
};

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function formatPushTime(start: string, end: string, timeZone: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const startTimeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const datePart = dateFmt.format(startDate).replace(/,/g, "");
  return `${datePart} · ${startTimeFmt.format(startDate)}–${timeFmt.format(endDate)}`;
}

function formatPeople(people: Array<{ name: string; email: string }>): string {
  return people.map((p) => `${p.name} · ${p.email}`).join(", ");
}

export function buildPushCard(payload: ChatPushPayload): ChatElement {
  const badge =
    NOTIFICATION_BADGES[payload.notificationType] ??
    `📅 ${payload.notificationType.replace(/_/g, " ").toLowerCase()}`;
  const when = formatPushTime(payload.start, payload.end, payload.timeZone);

  const meetingField = payload.meetingUrl
    ? isHttpUrl(payload.meetingUrl)
      ? [Field({ label: "Meeting", value: `[Join](${payload.meetingUrl})` })]
      : [Field({ label: "Meeting", value: payload.meetingUrl })]
    : payload.location
      ? [Field({ label: "Location", value: payload.location })]
      : [];

  const reasonField =
    (payload.notificationType === "BOOKING_CANCELLED" ||
      payload.notificationType === "BOOKING_REJECTED") &&
    payload.cancellationReason
      ? [Field({ label: "Reason", value: payload.cancellationReason })]
      : [];

  const bookingUrl = payload.data?.url;
  const viewBookingUrl =
    bookingUrl && isHttpUrl(bookingUrl) ? bookingUrl : "https://app.cal.com/bookings";

  return Card({
    title: badge,
    subtitle: payload.title,
    children: [
      Fields([
        Field({ label: "When", value: when }),
        ...(payload.hosts.length > 0
          ? [Field({ label: "Hosts", value: formatPeople(payload.hosts) })]
          : []),
        ...(payload.attendees.length > 0
          ? [Field({ label: "Attendees", value: formatPeople(payload.attendees) })]
          : []),
        ...meetingField,
        ...reasonField,
      ]),
      Divider(),
      Actions([
        LinkButton({
          url: viewBookingUrl,
          label: "View Booking",
        }),
      ]),
    ],
  });
}
