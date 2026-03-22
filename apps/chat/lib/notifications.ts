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
import type { CalcomWebhookPayload, ScheduleAvailability } from "./calcom/types";
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

/** Read-only list of slots (no Select). Use for /cal availability without @user. */
export function availabilityListCard(
  slots: Array<{ time: string; label: string }>,
  eventTypeTitle: string,
  options?: { targetName?: string; hint?: string }
) {
  if (slots.length === 0) {
    const noSlotsMsg = options?.targetName
      ? `No available slots found for ${eventTypeTitle} with ${options.targetName} in the next 7 days.`
      : `No available slots found for ${eventTypeTitle} in the next 7 days.`;
    return Card({
      title: "No Available Slots",
      children: [
        CardText(noSlotsMsg),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  const subtitle = options?.targetName
    ? `For: ${eventTypeTitle} with ${options.targetName}`
    : `For: ${eventTypeTitle}`;

  return Card({
    title: "Your Available Slots",
    subtitle,
    children: [
      Fields(slots.slice(0, 5).map((s) => Field({ label: s.label, value: s.time }))),
      ...(options?.hint ? [CardText(options.hint)] : []),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
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
            options: slots
              .slice(0, 5)
              .map((slot) =>
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

export function helpCard() {
  return Card({
    title: "Cal.com Slack Bot",
    children: [
      Section([
        CardText("Here's what I can do:", { style: "bold" }),
        Fields([
          Field({ label: "/cal availability", value: "Check your availability" }),
          Field({ label: "/cal book <username>", value: "Book a meeting" }),
          Field({ label: "/cal bookings", value: "View upcoming bookings" }),
          Field({ label: "/cal cancel", value: "Cancel a booking" }),
          Field({ label: "/cal reschedule", value: "Reschedule a booking" }),
          Field({ label: "/cal event-types", value: "List your event types" }),
          Field({ label: "/cal schedules", value: "Show your working hours" }),
          Field({ label: "/cal profile", value: "Show your profile" }),
          Field({ label: "/cal link, /cal unlink", value: "Connect or disconnect Cal.com" }),
          Field({ label: "/cal help", value: "Show this help message" }),
        ]),
      ]),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
    ],
  });
}

export function telegramHelpCard() {
  return Card({
    title: "Cal.com Bot",
    children: [
      Section([
        CardText("Here's what I can do:", { style: "bold" }),
        Fields([
          Field({ label: "/availability", value: "Check your availability" }),
          Field({ label: "/book <username>", value: "Book a meeting" }),
          Field({ label: "/bookings", value: "View upcoming bookings" }),
          Field({ label: "/cancel", value: "Cancel a booking" }),
          Field({ label: "/reschedule", value: "Reschedule a booking" }),
          Field({ label: "/eventtypes", value: "List your event types" }),
          Field({ label: "/schedules", value: "Show your working hours" }),
          Field({ label: "/profile", value: "Show your profile" }),
          Field({ label: "/link / /unlink", value: "Connect or disconnect Cal.com" }),
          Field({ label: "/help · @mention", value: "Help or ask in natural language" }),
        ]),
      ]),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
    ],
  });
}

// ─── Profile card ───────────────────────────────────────────────────────────

export function profileCard(linked: {
  calcomUsername: string;
  calcomEmail: string;
  calcomTimeZone: string;
  linkedAt: string;
  calcomOrganizationId: number | null;
}) {
  const linkedDate = new Date(linked.linkedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return Card({
    title: "Your Cal.com Profile",
    children: [
      Fields([
        Field({ label: "Username", value: linked.calcomUsername }),
        Field({ label: "Email", value: linked.calcomEmail }),
        Field({ label: "Timezone", value: linked.calcomTimeZone }),
        Field({ label: "Linked since", value: linkedDate }),
        ...(linked.calcomOrganizationId
          ? [Field({ label: "Organization", value: `ID ${linked.calcomOrganizationId}` })]
          : []),
      ]),
      Divider(),
      Actions([
        LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" }),
      ]),
      CardText("Use /unlink to disconnect your account."),
    ],
  });
}

// ─── Event types list card ──────────────────────────────────────────────────

export function eventTypesListCard(
  eventTypes: Array<{ title: string; slug: string; length: number; hidden: boolean; bookingUrl?: string | null }>
) {
  if (eventTypes.length === 0) {
    return Card({
      title: "Event Types",
      children: [
        CardText("You have no event types."),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  const fields = eventTypes.map((et) =>
    Field({
      label: `${et.title}${et.hidden ? " (hidden)" : ""}`,
      value: et.bookingUrl ? `${et.length}min · ${et.bookingUrl}` : `${et.length}min`,
    })
  );
  const chunks: (typeof fields)[] = [];
  for (let i = 0; i < fields.length; i += 10) {
    chunks.push(fields.slice(i, i + 10));
  }

  return Card({
    title: `Your Event Types (${eventTypes.length})`,
    children: [
      ...chunks.map((chunk) => Fields(chunk)),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
    ],
  });
}

// ─── Schedules list card ────────────────────────────────────────────────────

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export function formatAvailabilitySummary(availability: ScheduleAvailability[]): string {
  if (availability.length === 0) return "No hours set";

  // Build a map of timeRange -> sorted days
  const rangeMap = new Map<string, string[]>();
  for (const entry of availability) {
    const range = `${entry.startTime}-${entry.endTime}`;
    for (const day of entry.days) {
      const existing = rangeMap.get(range) ?? [];
      existing.push(day);
      rangeMap.set(range, existing);
    }
  }

  const parts: string[] = [];
  for (const [range, days] of rangeMap.entries()) {
    const sorted = days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const dayStr = compressDays(sorted);
    parts.push(`${dayStr} ${range}`);
  }
  return parts.join(", ");
}

function compressDays(sortedDays: string[]): string {
  if (sortedDays.length === 0) return "";
  if (sortedDays.length === 1) return DAY_SHORT[sortedDays[0]] ?? sortedDays[0];

  const runs: string[][] = [];
  let currentRun = [sortedDays[0]];

  for (let i = 1; i < sortedDays.length; i++) {
    const prevIdx = DAY_ORDER.indexOf(sortedDays[i - 1]);
    const currIdx = DAY_ORDER.indexOf(sortedDays[i]);
    if (currIdx === prevIdx + 1) {
      currentRun.push(sortedDays[i]);
    } else {
      runs.push(currentRun);
      currentRun = [sortedDays[i]];
    }
  }
  runs.push(currentRun);

  return runs
    .map((run) => {
      if (run.length <= 2) return run.map((d) => DAY_SHORT[d] ?? d).join(", ");
      return `${DAY_SHORT[run[0]] ?? run[0]}-${DAY_SHORT[run[run.length - 1]] ?? run[run.length - 1]}`;
    })
    .join(", ");
}

export function schedulesListCard(
  schedules: Array<{
    name: string;
    isDefault: boolean;
    timeZone: string;
    availability: ScheduleAvailability[];
  }>
) {
  if (schedules.length === 0) {
    return Card({
      title: "Schedules",
      children: [
        CardText("You have no schedules."),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  const fields = schedules.map((s) =>
    Field({
      label: `${s.name}${s.isDefault ? " (default)" : ""}`,
      value: `${s.timeZone}\n${formatAvailabilitySummary(s.availability)}`,
    })
  );
  const chunks: (typeof fields)[] = [];
  for (let i = 0; i < fields.length; i += 10) {
    chunks.push(fields.slice(i, i + 10));
  }

  return Card({
    title: `Your Schedules (${schedules.length})`,
    children: [
      ...chunks.map((chunk) => Fields(chunk)),
      Divider(),
      Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
    ],
  });
}

// ─── Cancel flow cards ──────────────────────────────────────────────────────

export function cancelBookingPickerCard(
  bookings: Array<{
    uid: string;
    title: string;
    start: string;
    end: string;
  }>
) {
  if (bookings.length === 0) {
    return Card({
      title: "Cancel Booking",
      children: [
        CardText("You have no upcoming bookings to cancel."),
        Actions([LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" })]),
      ],
    });
  }

  return Card({
    title: "Cancel a Booking",
    subtitle: "Select a booking to cancel",
    children: bookings.flatMap((b, i) => {
      const time = formatBookingTime(b.start, b.end);
      return [
        CardText(`${i + 1}. **${b.title}**\n${time}`),
        Actions([Button({ id: "cancel_bk", value: b.uid, label: `Cancel #${i + 1}` })]),
      ];
    }),
  });
}

export function cancelConfirmCard(
  title: string,
  date: string,
  isRecurring: boolean
) {
  const buttons = [
    Button({ id: "cancel_confirm", style: "danger" as const, label: "Cancel this booking" }),
  ];
  if (isRecurring) {
    buttons.push(
      Button({ id: "cancel_all", style: "danger" as const, label: "Cancel all future" })
    );
  }
  buttons.push(Button({ id: "cancel_back", label: "Go back" }));

  return Card({
    title: "Confirm Cancellation",
    children: [
      Fields([
        Field({ label: "Booking", value: title }),
        Field({ label: "When", value: date }),
      ]),
      Divider(),
      Actions(buttons),
    ],
  });
}

// ─── Reschedule flow cards ──────────────────────────────────────────────────

export function rescheduleBookingPickerCard(
  bookings: Array<{
    uid: string;
    title: string;
    start: string;
    end: string;
  }>
) {
  if (bookings.length === 0) {
    return Card({
      title: "Reschedule Booking",
      children: [
        CardText("You have no upcoming bookings to reschedule."),
        Actions([LinkButton({ url: `${CALCOM_APP_URL}/bookings`, label: "View Bookings" })]),
      ],
    });
  }

  return Card({
    title: "Reschedule a Booking",
    subtitle: "Select a booking to reschedule",
    children: bookings.flatMap((b, i) => {
      const time = formatBookingTime(b.start, b.end);
      return [
        CardText(`${i + 1}. **${b.title}**\n${time}`),
        Actions([Button({ id: "reschedule_bk", value: b.uid, label: `Reschedule #${i + 1}` })]),
      ];
    }),
  });
}

export function rescheduleSlotPickerCard(
  slots: Array<{ time: string; label: string }>,
  bookingTitle: string,
  originalTime: string
) {
  return Card({
    title: "Pick a New Time",
    subtitle: bookingTitle,
    children: [
      CardText(`Currently: ${originalTime}`),
      Section([
        CardText("Select a new time:"),
        Actions([
          Select({
            id: "reschedule_select_slot",
            label: "New Time",
            placeholder: "Select a new time",
            options: slots
              .slice(0, 5)
              .map((slot) =>
                SelectOption({ label: slot.label, value: slot.time, description: "Available slot" })
              ),
          }),
        ]),
      ]),
    ],
  });
}

export function rescheduleConfirmCard(
  bookingTitle: string,
  oldTime: string,
  newTime: string
) {
  return Card({
    title: "Confirm Reschedule",
    children: [
      Fields([
        Field({ label: "Booking", value: bookingTitle }),
        Field({ label: "Old time", value: oldTime }),
        Field({ label: "New time", value: newTime }),
      ]),
      Divider(),
      Actions([
        Button({ id: "reschedule_confirm", style: "primary" as const, label: "Confirm" }),
        Button({ id: "reschedule_back", style: "danger" as const, label: "Cancel" }),
      ]),
    ],
  });
}

// ─── Telegram booking flow cards ────────────────────────────────────────────

export function telegramEventTypePickerCard(
  eventTypes: Array<{ title: string; slug: string; length: number }>,
  targetUsername: string
) {
  return Card({
    title: `Book with ${targetUsername}`,
    subtitle: "Select an event type",
    children: [
      ...eventTypes.slice(0, 20).map((et, i) =>
        Actions([
          Button({
            id: `tg_book_et_${i}`,
            label: `${et.title} (${et.length}min)`,
          }),
        ])
      ),
      ...(eventTypes.length > 20 ? [CardText("Showing first 20 event types.")] : []),
      Actions([Button({ id: "tg_book_cancel", style: "danger" as const, label: "Cancel" })]),
    ],
  });
}

export function telegramSlotPickerCard(
  slots: Array<{ time: string; label: string }>,
  eventTypeTitle: string
) {
  return Card({
    title: "Pick a Time",
    subtitle: eventTypeTitle,
    children: [
      ...slots.slice(0, 5).map((s, i) =>
        Actions([
          Button({ id: `tg_book_slot_${i}`, label: s.label }),
        ])
      ),
      Actions([Button({ id: "tg_book_cancel", style: "danger" as const, label: "Cancel" })]),
    ],
  });
}

export function telegramBookingConfirmCard(
  eventTypeTitle: string,
  slotLabel: string,
  targetName: string
) {
  return Card({
    title: "Confirm Booking",
    children: [
      Fields([
        Field({ label: "Event", value: eventTypeTitle }),
        Field({ label: "When", value: slotLabel }),
        Field({ label: "With", value: targetName }),
      ]),
      Divider(),
      Actions([
        Button({ id: "tg_book_confirm", style: "primary" as const, label: "Confirm" }),
        Button({ id: "tg_book_cancel", style: "danger" as const, label: "Cancel" }),
      ]),
    ],
  });
}

// ─── Availability event type picker ─────────────────────────────────────────

export function availabilityEventTypePickerCard(
  eventTypes: Array<{ id: number; title: string; length: number }>
) {
  return Card({
    title: "Check Availability",
    subtitle: "Select an event type to check slots for",
    children: [
      Section([
        Actions([
          Select({
            id: "select_availability_event_type",
            label: "Event Type",
            placeholder: "Select an event type",
            options: eventTypes.map((et) =>
              SelectOption({ label: `${et.title} (${et.length}min)`, value: String(et.id) })
            ),
          }),
        ]),
      ]),
    ],
  });
}

// ─── Public booking flow cards (Slack /cal book <username>) ─────────────────

export function bookEventTypePickerCard(
  eventTypes: Array<{ title: string; slug: string; length: number }>,
  targetUsername: string
) {
  return Card({
    title: `Book with ${targetUsername}`,
    subtitle: "Select an event type",
    children: [
      Section([
        Actions([
          Select({
            id: "select_book_event_type",
            label: "Event Type",
            placeholder: "Select an event type",
            options: eventTypes.slice(0, 100).map((et) =>
              SelectOption({ label: `${et.title} (${et.length}min)`, value: et.slug })
            ),
          }),
        ]),
      ]),
    ],
  });
}

export function bookSlotPickerCard(
  slots: Array<{ time: string; label: string }>,
  eventTypeTitle: string,
  targetUsername: string
) {
  if (slots.length === 0) {
    return Card({
      title: "No Available Slots",
      children: [
        CardText(
          `No available slots found for ${eventTypeTitle} with ${targetUsername} in the next 7 days.`
        ),
        Actions([LinkButton({ url: CALCOM_APP_URL, label: "Open Cal.com" })]),
      ],
    });
  }

  return Card({
    title: `Book with ${targetUsername}`,
    subtitle: eventTypeTitle,
    children: [
      Section([
        Actions([
          Select({
            id: "select_book_slot",
            label: "Time",
            placeholder: "Select a time",
            options: slots
              .slice(0, 5)
              .map((s) => SelectOption({ label: s.label, value: s.time })),
          }),
        ]),
      ]),
    ],
  });
}

export function bookConfirmCard(
  eventTypeTitle: string,
  slotLabel: string,
  targetUsername: string
) {
  return Card({
    title: "Confirm Booking",
    children: [
      Fields([
        Field({ label: "Event", value: eventTypeTitle }),
        Field({ label: "When", value: slotLabel }),
        Field({ label: "With", value: targetUsername }),
      ]),
      Divider(),
      Actions([
        Button({ id: "confirm_book", style: "primary", label: "Confirm" }),
        Button({ id: "cancel_book", style: "danger", label: "Cancel" }),
      ]),
    ],
  });
}
