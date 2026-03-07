import {
  Actions,
  Button,
  Card,
  CardText,
  Divider,
  Field,
  Fields,
  LinkButton,
  Section,
  Select,
  SelectOption,
} from "chat";
import type { CalcomWebhookPayload } from "./calcom/types";
import { formatBookingTime } from "./calcom/webhooks";

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";

function attendeeNames(payload: CalcomWebhookPayload["payload"]): string {
  return payload.attendees.map((a) => a.name).join(", ");
}

function meetingLink(payload: CalcomWebhookPayload["payload"]): string | null {
  return payload.videoCallData?.url ?? null;
}

export function bookingCreatedCard(webhook: CalcomWebhookPayload) {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);
  const link = meetingLink(payload);

  return Card({
    title: "New Booking",
    subtitle: payload.title,
    children: [
      Fields([
        Field({ label: "When", value: time }),
        Field({ label: "With", value: attendeeNames(payload) }),
        ...(payload.location ? [Field({ label: "Location", value: payload.location })] : []),
        ...(payload.description ? [Field({ label: "Notes", value: payload.description })] : []),
      ]),
      Divider(),
      Actions([
        ...(link ? [LinkButton({ url: link, label: "Join Meeting" })] : []),
        LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" }),
      ]),
    ],
  });
}

export function bookingCancelledCard(webhook: CalcomWebhookPayload) {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);

  return Card({
    title: "Booking Cancelled",
    subtitle: payload.title,
    children: [
      Fields([
        Field({ label: "Was scheduled for", value: time }),
        Field({ label: "With", value: attendeeNames(payload) }),
        ...(payload.cancellationReason
          ? [Field({ label: "Reason", value: payload.cancellationReason })]
          : []),
      ]),
      Divider(),
      Actions([LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" })]),
    ],
  });
}

export function bookingRescheduledCard(webhook: CalcomWebhookPayload) {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);
  const link = meetingLink(payload);

  return Card({
    title: "Booking Rescheduled",
    subtitle: payload.title,
    children: [
      Fields([
        Field({ label: "New time", value: time }),
        Field({ label: "With", value: attendeeNames(payload) }),
        ...(payload.rescheduleReason
          ? [Field({ label: "Reason", value: payload.rescheduleReason })]
          : []),
      ]),
      Divider(),
      Actions([
        ...(link ? [LinkButton({ url: link, label: "Join Meeting" })] : []),
        LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" }),
      ]),
    ],
  });
}

export function bookingReminderCard(webhook: CalcomWebhookPayload) {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);
  const link = meetingLink(payload);

  return Card({
    title: "Upcoming Meeting Reminder",
    subtitle: payload.title,
    children: [
      Fields([
        Field({ label: "When", value: time }),
        Field({ label: "With", value: attendeeNames(payload) }),
      ]),
      Divider(),
      Actions([...(link ? [LinkButton({ url: link, label: "Join Meeting" })] : [])]),
    ],
  });
}

export function bookingConfirmedCard(webhook: CalcomWebhookPayload) {
  const { payload } = webhook;
  const time = formatBookingTime(payload.startTime, payload.endTime, payload.organizer.timeZone);
  const link = meetingLink(payload);

  return Card({
    title: "Booking Confirmed",
    subtitle: payload.title,
    children: [
      CardText("Your booking has been confirmed.", { style: "bold" }),
      Fields([
        Field({ label: "When", value: time }),
        Field({ label: "With", value: attendeeNames(payload) }),
      ]),
      Divider(),
      Actions([
        ...(link ? [LinkButton({ url: link, label: "Join Meeting" })] : []),
        LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" }),
      ]),
    ],
  });
}

export function upcomingBookingsCard(
  bookings: Array<{
    uid: string;
    title: string;
    start: string;
    end: string;
    attendees: Array<{ name: string; email: string }>;
    meetingUrl: string | null;
  }>
) {
  if (bookings.length === 0) {
    return Card({
      title: "Upcoming Bookings",
      children: [
        CardText("You have no upcoming bookings."),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  return Card({
    title: `Upcoming Bookings (${bookings.length})`,
    children: [
      ...bookings.slice(0, 5).flatMap((b) => {
        const time = formatBookingTime(b.start, b.end);
        const names = b.attendees.map((a) => a.name).join(", ");
        return [
          Fields([Field({ label: b.title, value: time }), Field({ label: "With", value: names })]),
        ];
      }),
      Divider(),
      Actions([LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View All Bookings" })]),
    ],
  });
}

export function availabilityCard(
  slots: Array<{ time: string; label: string }>,
  eventTypeTitle: string,
  targetUserName: string
) {
  if (slots.length === 0) {
    return Card({
      title: "No Available Slots",
      children: [
        CardText(
          `No available slots found for ${eventTypeTitle} with ${targetUserName} in the next 7 days.`
        ),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  return Card({
    title: `Available Times with ${targetUserName}`,
    subtitle: `For: ${eventTypeTitle}`,
    children: [
      Section([
        CardText("Select a time to book:"),
        Actions([
          Select({
            id: "select_slot",
            label: "Time",
            placeholder: "Select a time to book",
          options: slots.slice(0, 5).map((slot) =>
            SelectOption({ label: slot.label, value: slot.time, description: "Available slot" })
          ),
          }),
        ]),
      ]),
    ],
  });
}

export function bookingConfirmationCard(
  eventTypeTitle: string,
  slotLabel: string,
  attendeeName: string
) {
  return Card({
    title: "Confirm Booking",
    children: [
      Section([
        Fields([
          Field({ label: "Event", value: eventTypeTitle }),
          Field({ label: "When", value: slotLabel }),
          Field({ label: "With", value: attendeeName }),
        ]),
      ]),
      Divider(),
      Actions([
        Button({ id: "confirm_booking", style: "primary", label: "Confirm" }),
        Button({ id: "cancel_booking", style: "danger", label: "Cancel" }),
      ]),
    ],
  });
}

export function linkAccountCard() {
  return Card({
    title: "Connect Your Cal.com Account",
    children: [
      Section([
        CardText(
          "To use Cal.com in Slack, run **`/cal link`** to connect your account with Cal.com."
        ),
      ]),
    ],
  });
}

export function helpCard() {
  return Card({
    title: "Cal.com Slack Bot",
    children: [
      Section([
        CardText("Here's what I can do:", { style: "bold" }),
        Fields([
          Field({
            label: "/cal availability [@user] [date]",
            value: "Check someone's availability",
          }),
          Field({ label: "/cal book @user", value: "Book a meeting with someone" }),
          Field({ label: "/cal my-bookings", value: "View your upcoming bookings" }),
          Field({ label: "/cal link", value: "Connect your Cal.com account" }),
          Field({ label: "/cal unlink", value: "Disconnect your Cal.com account" }),
          Field({ label: "/cal help", value: "Show this help message" }),
        ]),
      ]),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
    ],
  });
}
