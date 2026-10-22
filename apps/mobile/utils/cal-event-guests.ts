/**
 * The Guests tab's logic, after the web's (`apps/web/modules/events/components/guest-list.tsx` and
 * its helpers): filters, counts and pages over the roster, how a guest reads, invite parsing and
 * results, the message composer's recipients, sent message statuses and the CSV download. The
 * roster is every guest in the statuses the tab lists (see getCalEventRoster), so all of it runs
 * on the phone.
 */

import type {
  CalEvent,
  CalEventApproveAllResult,
  CalEventInvitationReason,
  CalEventInvitationResult,
  CalEventLocation,
  CalEventMessage,
  CalEventMessageSegment,
  CalEventRegistrationCounts,
  CalEventRegistrationDecision,
  CalEventRegistrationField,
  CalEventRegistrationStatus,
  CalEventRosterGuest,
  CalEventRsvpResponse,
} from "@/services/types/cal-events.types";
import { CAL_EVENT_SYSTEM_FIELD_LABELS } from "@/utils/cal-event-edit";
import { formatCalEventPrice, getAdmissionLocations } from "@/utils/cal-events";

/** Rows per page, as on the web. */
export const GUESTS_PAGE_SIZE = 25;

export const CAL_EVENT_RSVP_LABELS: Record<CalEventRsvpResponse, string> = {
  YES: "Going",
  MAYBE: "Maybe",
  NO: "Not going",
};

/** The Registration line of a guest's details, in the web's words. */
export const CAL_EVENT_REGISTRATION_STATUS_LABELS: Record<CalEventRegistrationStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  WAITLISTED: "Waitlisted",
  PENDING_CONFIRMATION: "Confirmation needed",
  PENDING_PAYMENT: "Payment pending",
  OFFER_EXPIRED: "Offer expired",
  CONFIRMED: "Approved",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export type GuestBadgeTone = "success" | "warning" | "error" | "neutral";

/** The web's badge for a status that still needs something, or that ended the registration. */
const REGISTRATION_STATUS_BADGES: Partial<
  Record<CalEventRegistrationStatus, { label: string; tone: GuestBadgeTone }>
> = {
  PENDING_APPROVAL: { label: "Needs approval", tone: "warning" },
  WAITLISTED: { label: "Waitlisted", tone: "neutral" },
  PENDING_CONFIRMATION: { label: "Confirmation needed", tone: "warning" },
  PENDING_PAYMENT: { label: "Payment needed", tone: "warning" },
  OFFER_EXPIRED: { label: "Offer expired", tone: "error" },
  DECLINED: { label: "Declined", tone: "error" },
  CANCELLED: { label: "Cancelled", tone: "error" },
};

const RSVP_BADGE_TONES: Record<CalEventRsvpResponse, GuestBadgeTone> = {
  YES: "success",
  MAYBE: "warning",
  NO: "error",
};

/** A guest's badge, as the web's: their status while it needs something, else their RSVP. */
export function getGuestBadge(guest: Pick<CalEventRosterGuest, "status" | "rsvpResponse">): {
  label: string;
  tone: GuestBadgeTone;
} {
  return (
    REGISTRATION_STATUS_BADGES[guest.status] ?? {
      label: CAL_EVENT_RSVP_LABELS[guest.rsvpResponse],
      tone: RSVP_BADGE_TONES[guest.rsvpResponse],
    }
  );
}

const ATTENDANCE_INTENT_LABELS: Record<CalEventRsvpResponse, string> = {
  YES: "Wants to attend",
  MAYBE: "May attend",
  NO: "Doesn't plan to attend",
};

/**
 * The line under a waiting guest's name: whether they mean to come, as on the web. null for the
 * rest, who show when they registered.
 */
export function getGuestIntent(
  guest: Pick<CalEventRosterGuest, "status" | "rsvpResponse">
): string | null {
  if (guest.status !== "PENDING_APPROVAL" && guest.status !== "WAITLISTED") return null;
  return ATTENDANCE_INTENT_LABELS[guest.rsvpResponse];
}

type GuestPaymentState = "paid" | "refunded" | "awaiting";

const GUEST_PAYMENT_LABELS: Record<GuestPaymentState, string> = {
  paid: "Paid",
  refunded: "Refunded",
  awaiting: "Awaiting payment",
};

/** What happened to a guest's money, as the web's: refunded or paid, else awaiting while they owe it. */
function getGuestPaymentState(
  guest: Pick<CalEventRosterGuest, "status" | "payment">
): GuestPaymentState | null {
  if (guest.payment?.refunded) return "refunded";
  if (guest.payment?.success) return "paid";
  if (guest.status === "PENDING_PAYMENT") return "awaiting";
  return null;
}

/**
 * The guest's payment as the web words it, with the amount: "Paid · €20.00", "Refunded · €20.00".
 * null for a guest who pays nothing.
 */
export function formatGuestPayment(
  guest: Pick<CalEventRosterGuest, "status" | "payment">
): string | null {
  const state = getGuestPaymentState(guest);
  if (!state) return null;
  const label = GUEST_PAYMENT_LABELS[state];
  return guest.payment
    ? `${label} · ${formatCalEventPrice(guest.payment.amount, guest.payment.currency)}`
    : label;
}

/**
 * The line under a guest's name, as the web's: whether a waiting guest means to come, what a paying
 * guest paid, else when they registered.
 */
export function getGuestContext(
  guest: Pick<CalEventRosterGuest, "status" | "rsvpResponse" | "payment" | "createdAt">
): string {
  const intent = getGuestIntent(guest);
  if (intent) return intent;
  const registered = `Registered ${formatRelativeTime(guest.createdAt)}`;
  if (guest.status === "PENDING_PAYMENT") {
    // The badge already says a payment is needed; this says how much.
    return guest.payment
      ? `Payment · ${formatCalEventPrice(guest.payment.amount, guest.payment.currency)}`
      : registered;
  }
  return formatGuestPayment(guest) ?? registered;
}

/** Like the web, a no-show shows only on a guest who still holds their place. */
export function isGuestNoShow(guest: Pick<CalEventRosterGuest, "status" | "noShow">): boolean {
  return guest.status === "CONFIRMED" && guest.noShow;
}

/** The label for when a host decided on the guest: what they decided. */
export function getGuestDecidedLabel(status: CalEventRegistrationStatus): string {
  return status === "DECLINED" ? "Declined" : "Approved";
}

/**
 * The chips over the list, as the web's phone tabs. Going is confirmed guests going; Maybe and
 * Not going are that answer in any status.
 */
export type GuestFilter =
  | "ALL"
  | "GOING"
  | "MAYBE"
  | "NOT_GOING"
  | "PENDING_APPROVAL"
  | "WAITLISTED"
  | "PENDING_PAYMENT";

export const GUEST_FILTER_LABELS: Record<GuestFilter, string> = {
  ALL: "All",
  GOING: CAL_EVENT_RSVP_LABELS.YES,
  MAYBE: CAL_EVENT_RSVP_LABELS.MAYBE,
  NOT_GOING: CAL_EVENT_RSVP_LABELS.NO,
  PENDING_APPROVAL: "Pending approval",
  WAITLISTED: "Waitlist",
  PENDING_PAYMENT: "Pending payment",
};

function matchesFilter(guest: CalEventRosterGuest, filter: GuestFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "GOING":
      return guest.status === "CONFIRMED" && guest.rsvpResponse === "YES";
    case "MAYBE":
      return guest.rsvpResponse === "MAYBE";
    case "NOT_GOING":
      return guest.rsvpResponse === "NO";
    default:
      return guest.status === filter;
  }
}

/**
 * The chips to show. Like the web, Waitlist only on an event with a waitlist and Pending payment
 * only on a paid one, unless guests are already there from before a setting changed.
 */
export function getGuestFilters(
  guests: CalEventRosterGuest[],
  { waitlistEnabled, paid }: { waitlistEnabled: boolean; paid: boolean }
): GuestFilter[] {
  const has = (status: CalEventRegistrationStatus) =>
    guests.some((guest) => guest.status === status);
  return [
    "ALL",
    "GOING",
    "MAYBE",
    "NOT_GOING",
    "PENDING_APPROVAL",
    ...(waitlistEnabled || has("WAITLISTED") ? (["WAITLISTED"] as const) : []),
    ...(paid || has("PENDING_PAYMENT") ? (["PENDING_PAYMENT"] as const) : []),
  ];
}

/** Guests who registered by phone get a placeholder address on this domain. */
const SMS_EMAIL_SUFFIX = "@sms.cal.com";

/** How to reach a guest: their email, or the number a phone guest registered with. */
export function getGuestContact(guest: Pick<CalEventRosterGuest, "email" | "phoneNumber">): {
  kind: "email" | "phone";
  value: string;
} {
  if (guest.phoneNumber && guest.email.endsWith(SMS_EMAIL_SUFFIX)) {
    return { kind: "phone", value: guest.phoneNumber };
  }
  return { kind: "email", value: guest.email };
}

/** The guest's name, else how to reach them. */
export function getGuestDisplayName(guest: CalEventRosterGuest): string {
  return guest.name.trim() || getGuestContact(guest).value;
}

/** The avatar's letter, as the web's: "Ada Lovelace" → "A"; "+371…" → "+". */
export function getGuestInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

export interface RosterFilters {
  search: string;
  /** null = every location. */
  locationId: string | null;
  filter: GuestFilter;
}

function matchesSearch(guest: CalEventRosterGuest, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [guest.name, guest.email, guest.phoneNumber ?? ""].some((value) =>
    value.toLowerCase().includes(query)
  );
}

function matchesLocation(guest: CalEventRosterGuest, locationId: string | null): boolean {
  return locationId === null || guest.locationId === locationId;
}

/** The guests the list shows for a search, a location and a chip. */
export function filterRoster(
  guests: CalEventRosterGuest[],
  { search, locationId, filter }: RosterFilters
): CalEventRosterGuest[] {
  return guests.filter(
    (guest) =>
      matchesSearch(guest, search) &&
      matchesLocation(guest, locationId) &&
      matchesFilter(guest, filter)
  );
}

/** Each chip's count. They follow the search and the location, not the chip that's picked. */
export function countRoster(
  guests: CalEventRosterGuest[],
  { search, locationId }: Omit<RosterFilters, "filter">
): Record<GuestFilter, number> {
  const counts = Object.fromEntries(
    Object.keys(GUEST_FILTER_LABELS).map((filter) => [filter, 0])
  ) as Record<GuestFilter, number>;
  for (const guest of guests) {
    if (!matchesSearch(guest, search) || !matchesLocation(guest, locationId)) continue;
    for (const filter of Object.keys(counts) as GuestFilter[]) {
      if (matchesFilter(guest, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

/**
 * Each chip's count from the server's, as the web's tabs read them: All is every status the list
 * holds. Event-wide, so only for a list no search or location narrows.
 */
export function getGuestFilterCounts(
  counts: CalEventRegistrationCounts
): Record<GuestFilter, number> {
  return {
    ALL:
      counts.confirmed +
      counts.pendingApproval +
      counts.waitlisted +
      counts.pendingPayment +
      counts.declined +
      counts.cancelled,
    GOING: counts.going,
    MAYBE: counts.rsvpResponses.maybe,
    NOT_GOING: counts.rsvpResponses.no,
    PENDING_APPROVAL: counts.pendingApproval,
    WAITLISTED: counts.waitlisted,
    PENDING_PAYMENT: counts.pendingPayment,
  };
}

/** One page of the filtered list (0-based, held to the last page), and its "1-25 of 60" line. */
export function getRosterPage<T>(
  rows: T[],
  page: number
): { rows: T[]; page: number; pageCount: number; range: string } {
  const pageCount = Math.max(1, Math.ceil(rows.length / GUESTS_PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * GUESTS_PAGE_SIZE;
  const pageRows = rows.slice(start, start + GUESTS_PAGE_SIZE);
  return {
    rows: pageRows,
    page: current,
    pageCount,
    range:
      rows.length === 0 ? "0 of 0" : `${start + 1}-${start + pageRows.length} of ${rows.length}`,
  };
}

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: string }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** What `Intl.RelativeTimeFormat("en", { numeric: "auto" })` says for -1, 0 and 1 of a unit. */
const RELATIVE_TIME_WORDS: Record<string, Record<number, string>> = {
  second: { 0: "now" },
  minute: { 0: "this minute" },
  hour: { 0: "this hour" },
  day: { [-1]: "yesterday", 0: "today", 1: "tomorrow" },
  week: { [-1]: "last week", 0: "this week", 1: "next week" },
  month: { [-1]: "last month", 0: "this month", 1: "next month" },
  year: { [-1]: "last year", 0: "this year", 1: "next year" },
};

/**
 * "2 months ago", in the web's steps. Written out because Hermes has no Intl.RelativeTimeFormat;
 * the words are its English with `numeric: "auto"`.
 */
export function formatRelativeTime(date: string | Date, now: number = Date.now()): string {
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return "";
  let duration = (time - now) / 1000;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      // `|| 0` turns Math.round's -0 into 0.
      const value = Math.round(duration) || 0;
      const word = RELATIVE_TIME_WORDS[division.unit][value];
      if (word) return word;
      const amount = Math.abs(value);
      const unit = amount === 1 ? division.unit : `${division.unit}s`;
      return value < 0 ? `${amount} ${unit} ago` : `in ${amount} ${unit}`;
    }
    duration /= division.amount;
  }
  return "";
}

/** "Dec 2, 2029, 10:00 AM": the web's medium date and short time. */
export function formatGuestDateTime(date: string | Date): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type GuestLocationOption = {
  id: string;
  label: string;
  /** The location's seat cap; null when it has none. */
  capacity: number | null;
};

function locationTitle(location: CalEventLocation): string {
  if (location.type === "address") return "In person";
  if (location.type === "link") return "Online link";
  return "Online meeting";
}

function locationDetail(location: CalEventLocation): string | null {
  const detail =
    location.label?.trim() ||
    (location.type === "address" ? location.address.trim() : "") ||
    (location.type === "link" ? location.link.trim() : "");
  return detail || null;
}

/**
 * The locations guests can be told apart by: "In person · Main hall". Empty with fewer than two,
 * since every guest then chose the same place (the web hides the filter and the row's location).
 */
export function getGuestLocationOptions(locations: CalEventLocation[]): GuestLocationOption[] {
  const admission = getAdmissionLocations(locations);
  if (admission.length < 2) return [];
  return admission.flatMap((location) => {
    if (!location.id) return [];
    const detail = locationDetail(location);
    const title = locationTitle(location);
    return [
      {
        id: location.id,
        label: detail ? `${title} · ${detail}` : title,
        capacity: location.capacity ?? null,
      },
    ];
  });
}

/** A guest's location as the host reads it; null when there's nothing to tell apart. */
export function getGuestLocationLabel(
  locationId: string | null,
  options: GuestLocationOption[]
): string | null {
  if (!locationId || options.length === 0) return null;
  // A free event's host can remove a location guests already chose.
  return options.find((option) => option.id === locationId)?.label ?? "Removed location";
}

/**
 * How full a location is, as the web's: "3 / 10 seats taken" when it has a cap, "3 seats taken"
 * when it doesn't. null while the counts load.
 */
export function formatLocationSeats(
  option: GuestLocationOption,
  byLocation: CalEventRegistrationCounts["byLocation"] | undefined
): string | null {
  if (!byLocation) return null;
  const taken = byLocation.find((row) => row.locationId === option.id)?.count ?? 0;
  if (option.capacity === null) return `${taken} ${taken === 1 ? "seat" : "seats"} taken`;
  return `${taken} / ${option.capacity} seats taken`;
}

/** The key a question's answer has in `responses`: a custom question's identifier, else its field. */
function registrationFieldKey(field: CalEventRegistrationField): string | null {
  if (field.field === "custom") return field.slug || null;
  return field.field;
}

function registrationFieldLabel(field: CalEventRegistrationField, key: string): string {
  return field.label?.trim() || CAL_EVENT_SYSTEM_FIELD_LABELS[key] || key;
}

function answerText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() ? value : null;
  if (Array.isArray(value)) {
    const items = value.map(answerText).filter((item): item is string => item !== null);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value !== "object") return String(value);
  return JSON.stringify(value) ?? null;
}

/** A guest's answers to the registration form, labelled; name and email have their own rows. */
export function getGuestAnswerEntries(
  responses: Record<string, unknown>,
  fields: CalEventRegistrationField[] = []
): { key: string; label: string; value: string }[] {
  const labels = new Map<string, string>();
  for (const field of fields) {
    const key = registrationFieldKey(field);
    if (key) labels.set(key, registrationFieldLabel(field, key));
  }
  const entries: { key: string; label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(responses)) {
    if (key === "name" || key === "email") continue;
    const value = answerText(raw);
    if (value === null) continue;
    entries.push({ key, label: labels.get(key) ?? key, value });
  }
  return entries;
}

/** The API's limits on one invite. */
export const INVITE_MAX_EMAILS = 200;
export const INVITE_NOTE_MAX_LENGTH = 500;

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function isValidInviteEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/**
 * What was typed or pasted into the invite field: addresses split on commas, semicolons, spaces
 * and new lines, with `Name <email>` read as its address. New, valid addresses come back in
 * order; the rest are reported so the field can say why.
 */
export function parseInviteEmails(
  text: string,
  alreadyAdded: string[] = []
): { emails: string[]; invalid: string[]; duplicates: string[] } {
  const seen = new Set(alreadyAdded.map((email) => email.toLowerCase()));
  const emails: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  // Angle-bracketed addresses first, so the display name before one isn't split into tokens.
  const tokens: string[] = [];
  const rest = text.replace(/[^,;\n<>]*<([^<>]*)>/g, (_match, address: string) => {
    tokens.push(address);
    return " ";
  });
  tokens.push(...rest.split(/[\s,;]+/));
  for (const token of tokens) {
    const email = token.trim();
    if (!email) continue;
    if (!isValidInviteEmail(email)) {
      invalid.push(email);
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(email);
      continue;
    }
    seen.add(key);
    emails.push(email);
  }
  return { emails, invalid, duplicates };
}

const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

/** The skipped reasons in the web's order, with its "{count} …" wording. */
const INVITE_SKIP_REASONS: {
  reason: CalEventInvitationReason;
  label: (count: number) => string;
}[] = [
  {
    reason: "invalid-format",
    label: (n) => `${n} ${plural(n, "address isn't valid", "addresses aren't valid")}`,
  },
  {
    reason: "undeliverable",
    label: (n) => `${n} ${plural(n, "address can't receive mail", "addresses can't receive mail")}`,
  },
  {
    reason: "failed",
    label: (n) =>
      `${n} ${plural(n, "invite couldn't be created", "invites couldn't be created")} — try again`,
  },
  {
    reason: "already-registered",
    label: (n) =>
      `${n} ${plural(n, "guest has already registered", "guests have already registered")}`,
  },
  {
    reason: "already-invited",
    label: (n) => `${n} ${plural(n, "guest was already invited", "guests were already invited")}`,
  },
  {
    reason: "cooldown",
    label: (n) =>
      `${n} ${plural(n, "guest was re-invited too recently", "guests were re-invited too recently")}`,
  },
  {
    reason: "duplicate",
    label: (n) =>
      `${n} ${plural(n, "address was repeated in this batch", "addresses were repeated in this batch")}`,
  },
];

export type InviteSkippedGroup = { reason: string; label: string; emails: string[] };

/** The invite's outcome as the web words it, and the skipped addresses grouped by why. */
export function getInviteResultMessage(result: CalEventInvitationResult): {
  title: string;
  skippedGroups: InviteSkippedGroup[];
} {
  const skipped =
    result.skippedAlreadyInvited +
    result.skippedAlreadyRegistered +
    result.skippedOnCooldown +
    result.skippedInvalid;
  const failed = result.failedCount;
  const invited = result.invitedCount;
  const addresses = plural(skipped, "address was", "addresses were");
  let title: string;
  if (invited === 0) {
    if (failed > 0 && skipped > 0) {
      title = `No new invitations were sent. ${failed} failed to send. ${skipped} ${addresses} skipped.`;
    } else if (failed > 0) {
      title = `No new invitations were sent. ${failed} failed to send.`;
    } else {
      title = `No new invitations were sent. ${skipped} ${addresses} skipped.`;
    }
  } else if (failed > 0 && skipped > 0) {
    title = `Invited ${invited}. Skipped ${skipped} (already invited, registered, or invalid). ${failed} failed to send.`;
  } else if (failed > 0) {
    title = `Invited ${invited}. ${failed} failed to send.`;
  } else if (skipped > 0) {
    title = `Invited ${invited}. Skipped ${skipped} (already invited, registered, or invalid).`;
  } else {
    title = `Invited ${invited} ${plural(invited, "guest", "guests")}`;
  }
  const skippedGroups = INVITE_SKIP_REASONS.flatMap(({ reason, label }) => {
    const emails = result.outcomes
      .filter((outcome) => outcome.reason === reason)
      .map((outcome) => outcome.email);
    return emails.length > 0 ? [{ reason, label: label(emails.length), emails }] : [];
  });
  return { title, skippedGroups };
}

export const MESSAGE_SEGMENT_LABELS: Record<CalEventMessageSegment, string> = {
  GOING: "Going",
  MAYBE: "Maybe",
  PENDING: "Pending",
};

/** The API's limits on one message. */
export const MESSAGE_SUBJECT_MAX_LENGTH = 200;
export const MESSAGE_BODY_MAX_LENGTH = 5000;
export const MESSAGE_MAX_RECIPIENTS = 1000;

export type MessageCheckInFilter = "ANY" | "CHECKED_IN" | "NOT_CHECKED_IN";

/** Who each group is, as the server reads it (the web board's Pending, Going and Maybe columns). */
function inMessageSegment(guest: CalEventRosterGuest, segment: CalEventMessageSegment): boolean {
  if (segment === "PENDING") {
    return (
      guest.status === "PENDING_APPROVAL" ||
      guest.status === "WAITLISTED" ||
      guest.status === "PENDING_PAYMENT"
    );
  }
  return (
    guest.status === "CONFIRMED" && guest.rsvpResponse === (segment === "GOING" ? "YES" : "MAYBE")
  );
}

/** How many guests a message to one group would email: those in it with a real address. */
export function countMessageRecipients(
  roster: CalEventRosterGuest[],
  {
    segment,
    locationId,
    checkIn,
  }: { segment: CalEventMessageSegment; locationId: string | null; checkIn: MessageCheckInFilter }
): number {
  return roster.filter(
    (guest) =>
      inMessageSegment(guest, segment) &&
      matchesLocation(guest, locationId) &&
      (checkIn === "ANY" || (checkIn === "CHECKED_IN") === (guest.checkedInAt !== null)) &&
      getGuestContact(guest).kind === "email"
  ).length;
}

/** "3 guests will get this email", or why nobody will. */
export function formatMessageRecipients(count: number): string {
  if (count === 0) return "No guests in this group have an email address";
  if (count > MESSAGE_MAX_RECIPIENTS) {
    return `A message can go to at most ${MESSAGE_MAX_RECIPIENTS} guests at a time`;
  }
  return `${count} ${plural(count, "guest", "guests")} will get this email`;
}

/** A sent message's status in the web's words, the same in the Sent list and after Send. */
export function formatMessageStatus(message: Pick<CalEventMessage, "status" | "counts">): string {
  const sentCount = message.counts?.sentCount ?? 0;
  switch (message.status) {
    case "SENDING":
      return "Sending…";
    case "SENT":
      return `Sent to ${sentCount} ${plural(sentCount, "guest", "guests")}`;
    case "PARTIALLY_SENT": {
      const total = sentCount + (message.counts?.failedCount ?? 0);
      return `Sent to ${sentCount} of ${total} ${plural(total, "guest", "guests")}`;
    }
    case "NOT_SENT_EVENT_UNSENDABLE":
      return "Not sent. This event can no longer be messaged.";
    default:
      return "Not sent";
  }
}

/** "3 sent · 0 failed · 1 skipped by phone · 0 unsubscribed"; null while there are no counts. */
export function formatMessageCounts(counts: CalEventMessage["counts"]): string | null {
  if (!counts) return null;
  return `${counts.sentCount} sent · ${counts.failedCount} failed · ${counts.skippedPhoneCount} skipped by phone · ${counts.skippedUnsubscribedCount} unsubscribed`;
}

/** Who sent a message: their name, or why there's none. */
export function formatMessageSender(sender: CalEventMessage["sender"]): string {
  if (!sender) return "Deleted user";
  return sender.name?.trim() || "Unnamed user";
}

/** Approve all's confirmation, in the web's words. A paid event only sends payment requests. */
export function getApproveAllPrompt(count: number, { paid }: { paid: boolean }): string {
  const guests = `${count} pending ${plural(count, "guest", "guests")}`;
  return paid
    ? `Start payment approval for ${guests} in registration order.`
    : `Approve ${guests} in registration order.`;
}

export type GuestDecision = "approve" | "decline";

/**
 * What a host can decide for one guest, as the web's row buttons: approve or decline a guest
 * waiting for approval, decline one on the waitlist. Moving a guest up from the waitlist is the
 * web's alone.
 */
export function getGuestDecisions(status: CalEventRegistrationStatus): GuestDecision[] {
  if (status === "PENDING_APPROVAL") return ["approve", "decline"];
  if (status === "WAITLISTED") return ["decline"];
  return [];
}

/**
 * What to tell the host after approving one guest, in the web's words; null when the row's new
 * badge says it all.
 */
export function getDecisionMessage(
  kind: CalEventRegistrationDecision
): { title: string; message: string } | null {
  if (kind === "payment_pending") {
    return {
      title: "Payment link sent",
      message: "Approved. The guest has been sent a payment link to confirm their spot.",
    };
  }
  if (kind === "event_full_offer_waitlist") {
    return { title: "Event is full", message: "The guest wasn't seated and stays pending." };
  }
  return null;
}

/** What approve all did, in the web's words. */
export function getApproveAllMessage(result: CalEventApproveAllResult): string {
  if (result.kind === "started") return "Approval started. Refresh the guest list to see updates.";
  if (result.approvedCount === 0 && result.notSeatedCount === 0) {
    return "No pending registrations to approve";
  }
  if (result.notSeatedCount > 0) {
    return `Approved ${result.approvedCount}, but ${result.notSeatedCount} could not be seated because the event is full`;
  }
  return `Approved ${result.approvedCount} pending registrations`;
}

const CSV_BOM = "﻿";
const CSV_COLUMNS = [
  "name",
  "email",
  "phone",
  "status",
  "rsvp_response",
  "payment_status",
  "registered_at",
  "decided_at",
  "checked_in_at",
  "location",
  "no_show",
] as const;
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** One CSV cell, quoted like the web's, and defused so a spreadsheet won't run it as a formula. */
function csvCell(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (safe.includes('"')) return `"${safe.replace(/"/g, '""')}"`;
  if (/[,\n\r]/.test(safe)) return `"${safe}"`;
  return safe;
}

function csvAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(csvAnswer).join(",");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * The roster as the web's "all guests" CSV, without the waitlist position the API can't fill: one
 * row per guest, then one column per visible question. UTF-8 with a BOM so Excel reads names right.
 */
export function buildRosterCsv(
  guests: CalEventRosterGuest[],
  event: Pick<CalEvent, "registrationFields">,
  locations: CalEventLocation[]
): string {
  const used = new Set<string>(CSV_COLUMNS);
  const questions = (event.registrationFields ?? []).flatMap((field) => {
    const key = registrationFieldKey(field);
    if (!key || field.hidden || key === "name" || key === "email") return [];
    const base = registrationFieldLabel(field, key);
    // Labels can clash with each other or a fixed column; every answer keeps its own column.
    const label = used.has(base) ? `${base} (${key})` : base;
    used.add(base);
    used.add(label);
    return [{ key, label }];
  });
  const locationOptions = getGuestLocationOptions(locations);
  const header = [...CSV_COLUMNS, ...questions.map((question) => question.label)];
  const rows = guests.map((guest) => [
    guest.name,
    getGuestContact(guest).kind === "phone" ? "" : guest.email,
    guest.phoneNumber ?? "",
    guest.status,
    guest.rsvpResponse,
    getGuestPaymentState(guest) ?? "",
    new Date(guest.createdAt).toISOString(),
    guest.decidedAt ? new Date(guest.decidedAt).toISOString() : "",
    guest.checkedInAt ? new Date(guest.checkedInAt).toISOString() : "",
    getGuestLocationLabel(guest.locationId, locationOptions) ?? "",
    guest.noShow ? "yes" : "",
    ...questions.map((question) => csvAnswer(guest.responses[question.key])),
  ]);
  return CSV_BOM + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

/** "summer-party-all-2026-10-19.csv", as the web names it. */
export function rosterCsvFilename(slug: string, date: Date = new Date()): string {
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, "-") || "event";
  return `${safeSlug}-all-${date.toISOString().slice(0, 10)}.csv`;
}
