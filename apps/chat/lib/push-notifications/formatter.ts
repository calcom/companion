import type { DeliveryRequest } from "./contract";

export type FormattedNotification = { text: string; bookingUrl?: string };

export function safeUrl(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    /* Omit malformed links. */
  }
}

export function formatNotification(payload: DeliveryRequest["payload"]): FormattedNotification {
  const dateFormat = new Intl.DateTimeFormat("en", {
    timeZone: payload.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: payload.timeFormat !== 24,
  });
  const lines = [
    payload.title,
    payload.bookingTitle,
    payload.body,
    `When: ${dateFormat.format(new Date(payload.start))} – ${dateFormat.format(new Date(payload.end))} (${payload.timeZone})`,
  ];
  if (payload.hosts.length)
    lines.push(`Hosts: ${payload.hosts.map((p) => p.name || p.email).join(", ")}`);
  if (payload.attendees.length) {
    lines.push(
      `${payload.seatEvent ? "Attendee" : "Attendees"}: ${payload.attendees.map((p) => p.name || p.email).join(", ")}`
    );
  }
  if (payload.attendeeCount !== undefined && payload.attendeeCount > payload.attendees.length) {
    lines.push(`Attendees: ${payload.attendeeCount} total`);
  }
  if (payload.location) lines.push(`Location: ${payload.location}`);
  const meetingUrl = safeUrl(payload.meetingUrl);
  if (meetingUrl) lines.push(`Join: ${meetingUrl}`);
  if (payload.cancellationReason) lines.push(`Reason: ${payload.cancellationReason}`);
  if (payload.payment) {
    const fmt = new Intl.NumberFormat("en", {
      style: "currency",
      currency: payload.payment.currency.toUpperCase(),
    });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    lines.push(`Payment received: ${fmt.format(payload.payment.amount / 10 ** digits)}`);
  }
  // One bounded message avoids partial multi-message deliveries on retries.
  const full = lines.filter(Boolean).join("\n");
  return {
    text: full.length > 2900 ? `${full.slice(0, 2899)}…` : full,
    bookingUrl: safeUrl(payload.data?.url),
  };
}
