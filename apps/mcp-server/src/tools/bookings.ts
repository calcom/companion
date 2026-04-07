import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getBookingsSchema = {
  status: z.string().optional().describe("Comma-separated statuses: upcoming, recurring, past, cancelled, unconfirmed"),
  attendeeEmail: z.string().email().optional().describe("Filter by attendee email"),
  attendeeName: z.string().optional().describe("Filter by attendee name"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  eventTypeIds: z.string().optional().describe("Comma-separated event type IDs (e.g. '100,200')"),
  teamId: z.number().int().optional().describe("Filter by team ID"),
  teamsIds: z.string().optional().describe("Comma-separated team IDs (e.g. '50,60')"),
  afterStart: z.string().optional().describe("Filter bookings starting after this ISO 8601 date"),
  beforeEnd: z.string().optional().describe("Filter bookings ending before this ISO 8601 date"),
  afterCreatedAt: z.string().optional().describe("Filter bookings created after this ISO 8601 date"),
  beforeCreatedAt: z.string().optional().describe("Filter bookings created before this ISO 8601 date"),
  afterUpdatedAt: z.string().optional().describe("Filter bookings updated after this ISO 8601 date"),
  beforeUpdatedAt: z.string().optional().describe("Filter bookings updated before this ISO 8601 date"),
  bookingUid: z.string().optional().describe("Filter by booking UID"),
  sortStart: z.enum(["asc", "desc"]).optional().describe("Sort by start time"),
  sortEnd: z.enum(["asc", "desc"]).optional().describe("Sort by end time"),
  sortCreated: z.enum(["asc", "desc"]).optional().describe("Sort by creation time"),
  sortUpdatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by updated time"),
  take: z.number().int().optional().describe("Max results to return (default 100, max 250)"),
  skip: z.number().int().optional().describe("Results to skip (offset)"),
};

export async function getBookings(params: {
  status?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  eventTypeId?: number;
  eventTypeIds?: string;
  teamId?: number;
  teamsIds?: string;
  afterStart?: string;
  beforeEnd?: string;
  afterCreatedAt?: string;
  beforeCreatedAt?: string;
  afterUpdatedAt?: string;
  beforeUpdatedAt?: string;
  bookingUid?: string;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
  sortCreated?: "asc" | "desc";
  sortUpdatedAt?: "asc" | "desc";
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | undefined> = {};
    if (params.status !== undefined) qp.status = params.status;
    if (params.attendeeEmail !== undefined) qp.attendeeEmail = params.attendeeEmail;
    if (params.attendeeName !== undefined) qp.attendeeName = params.attendeeName;
    if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
    if (params.eventTypeIds !== undefined) qp.eventTypeIds = params.eventTypeIds;
    if (params.teamId !== undefined) qp.teamId = params.teamId;
    if (params.teamsIds !== undefined) qp.teamsIds = params.teamsIds;
    if (params.afterStart !== undefined) qp.afterStart = params.afterStart;
    if (params.beforeEnd !== undefined) qp.beforeEnd = params.beforeEnd;
    if (params.afterCreatedAt !== undefined) qp.afterCreatedAt = params.afterCreatedAt;
    if (params.beforeCreatedAt !== undefined) qp.beforeCreatedAt = params.beforeCreatedAt;
    if (params.afterUpdatedAt !== undefined) qp.afterUpdatedAt = params.afterUpdatedAt;
    if (params.beforeUpdatedAt !== undefined) qp.beforeUpdatedAt = params.beforeUpdatedAt;
    if (params.bookingUid !== undefined) qp.bookingUid = params.bookingUid;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    if (params.sortCreated !== undefined) qp.sortCreated = params.sortCreated;
    if (params.sortUpdatedAt !== undefined) qp.sortUpdatedAt = params.sortUpdatedAt;
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi("bookings", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_bookings", err);
  }
}

export const getBookingSchema = {
  bookingUid: z.string().describe("Booking UID"),
};

export async function getBooking(params: { bookingUid: string }) {
  try {
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}`);
    return ok(data);
  } catch (err) {
    return handleError("get_booking", err);
  }
}

export const createBookingSchema = {
  eventTypeId: z.number().int().optional().describe("Event type ID. Required unless eventTypeSlug + username (or teamSlug) are provided."),
  eventTypeSlug: z.string().optional().describe("Event type slug (e.g. '15min'). Must be combined with username (for individual) or teamSlug (for team)."),
  username: z.string().optional().describe("Username of the host whose calendar you are booking on. Required with eventTypeSlug for individual event types."),
  teamSlug: z.string().optional().describe("Team slug. Required with eventTypeSlug for team event types."),
  organizationSlug: z.string().optional().describe("Organization slug, needed when the user/team is within an organization."),
  start: z.string().describe("Start time in UTC, ISO 8601 (e.g. 2024-08-13T09:00:00Z). Must be UTC."),
  attendee: z
    .object({
      name: z.string().describe("Full name"),
      email: z.string().email().optional().describe("Email address (required unless phoneNumber is provided)"),
      timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
      phoneNumber: z.string().optional().describe("Phone in international format (e.g. +19876543210). Required when event type has SMS reminders."),
      language: z.string().optional().describe("ISO 639-1 language code (e.g. 'en')"),
    })
    .describe("Attendee details — the person making the booking (the guest/caller), NOT the host. To book another user's calendar, set their username in the 'username' field and put YOUR (the caller's) details here. NEVER guess or fabricate email addresses — ask the user if unknown."),
  guests: z.array(z.string().email()).optional().describe("Additional guest emails to include"),
  lengthInMinutes: z.number().int().optional().describe("Desired booking length for variable-duration event types. Uses event type default if omitted."),
  bookingFieldsResponses: z.record(z.unknown()).optional().describe("Custom booking field responses as {slug: value} pairs"),
  metadata: z.record(z.unknown()).optional().describe("Metadata key-value pairs (max 50 keys, keys ≤40 chars, string values ≤500 chars)"),
  location: z.union([z.string(), z.record(z.unknown())]).optional().describe("Meeting location override. Can be a URL string or a location object matching one of the event type's configured locations."),
  allowConflicts: z.boolean().optional().describe("If true, allow booking even if it overlaps with existing calendar events. Useful for hosts who need to force-book."),
  allowBookingOutOfBounds: z.boolean().optional().describe("If true, allow booking outside the event type's configured availability window (e.g. before minimumBookingNotice or beyond the booking window)."),
};

export async function createBooking(params: {
  eventTypeId?: number;
  eventTypeSlug?: string;
  username?: string;
  teamSlug?: string;
  organizationSlug?: string;
  start: string;
  attendee: { name: string; email?: string; timeZone: string; phoneNumber?: string; language?: string };
  guests?: string[];
  lengthInMinutes?: number;
  bookingFieldsResponses?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  location?: string | Record<string, unknown>;
  allowConflicts?: boolean;
  allowBookingOutOfBounds?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {
      start: params.start,
      attendee: params.attendee,
    };
    if (params.eventTypeId !== undefined) body.eventTypeId = params.eventTypeId;
    if (params.eventTypeSlug !== undefined) body.eventTypeSlug = params.eventTypeSlug;
    if (params.username !== undefined) body.username = params.username;
    if (params.teamSlug !== undefined) body.teamSlug = params.teamSlug;
    if (params.organizationSlug !== undefined) body.organizationSlug = params.organizationSlug;
    if (params.guests !== undefined) body.guests = params.guests;
    if (params.lengthInMinutes !== undefined) body.lengthInMinutes = params.lengthInMinutes;
    if (params.bookingFieldsResponses !== undefined) body.bookingFieldsResponses = params.bookingFieldsResponses;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.location !== undefined) body.location = params.location;
    if (params.allowConflicts !== undefined) body.allowConflicts = params.allowConflicts;
    if (params.allowBookingOutOfBounds !== undefined) body.allowBookingOutOfBounds = params.allowBookingOutOfBounds;
    const data = await calApi("bookings", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_booking", err);
  }
}

export const rescheduleBookingSchema = {
  bookingUid: z.string().describe("Booking UID"),
  start: z.string().describe("New start time in UTC, ISO 8601 (e.g. 2024-08-13T09:00:00Z)"),
  reschedulingReason: z.string().optional().describe("Reason for rescheduling"),
  rescheduledBy: z.string().optional().describe("Only needed when rescheduling a booking that requires confirmation. If the event owner's email is provided, the rescheduled booking is auto-confirmed; otherwise the owner must confirm. Use get_me to get the authenticated user's email — never fabricate."),
};

export async function rescheduleBooking(params: {
  bookingUid: string;
  start: string;
  reschedulingReason?: string;
  rescheduledBy?: string;
}) {
  try {
    const body: Record<string, unknown> = { start: params.start };
    if (params.reschedulingReason !== undefined) body.reschedulingReason = params.reschedulingReason;
    if (params.rescheduledBy !== undefined) body.rescheduledBy = params.rescheduledBy;
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/reschedule`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("reschedule_booking", err);
  }
}

export const cancelBookingSchema = {
  bookingUid: z.string().describe("Booking UID"),
  cancellationReason: z.string().optional().describe("Reason for cancellation"),
  cancelSubsequentBookings: z.boolean().optional().describe("For recurring non-seated bookings only: if true, also cancels all subsequent recurrences after this one."),
  seatUid: z.string().optional().describe("UID of the specific seat to cancel within a seated booking. Required when cancelling an individual seat instead of the entire booking."),
};

export async function cancelBooking(params: { bookingUid: string; cancellationReason?: string; cancelSubsequentBookings?: boolean; seatUid?: string }) {
  try {
    const body: Record<string, unknown> = {};
    if (params.cancellationReason !== undefined) body.cancellationReason = params.cancellationReason;
    if (params.cancelSubsequentBookings !== undefined) body.cancelSubsequentBookings = params.cancelSubsequentBookings;
    if (params.seatUid !== undefined) body.seatUid = params.seatUid;
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/cancel`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("cancel_booking", err);
  }
}

export const confirmBookingSchema = {
  bookingUid: z.string().describe("Booking UID"),
};

export async function confirmBooking(params: { bookingUid: string }) {
  try {
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/confirm`, {
      method: "POST",
      body: {},
    });
    return ok(data);
  } catch (err) {
    return handleError("confirm_booking", err);
  }
}

export const markBookingAbsentSchema = {
  bookingUid: z.string().describe("Booking UID"),
  host: z.boolean().optional().describe("Whether the host was absent"),
  attendees: z.array(z.object({
    email: z.string().describe("Attendee email from the booking — use get_booking_attendees to look up real emails"),
    absent: z.boolean(),
  })).optional().describe("Attendees with absent status. Use real attendee emails from the booking."),
};

export async function markBookingAbsent(params: {
  bookingUid: string;
  host?: boolean;
  attendees?: { email: string; absent: boolean }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.host !== undefined) body.host = params.host;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/mark-absent`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("mark_booking_absent", err);
  }
}

export const getBookingAttendeesSchema = {
  bookingUid: z.string().describe("Booking UID"),
};

export async function getBookingAttendees(params: {
  bookingUid: string;
}) {
  try {
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/attendees`);
    return ok(data);
  } catch (err) {
    return handleError("get_booking_attendees", err);
  }
}

export const addBookingAttendeeSchema = {
  bookingUid: z.string().describe("Booking UID"),
  name: z.string().describe("Attendee name"),
  timeZone: z.string().describe("IANA time zone"),
  phoneNumber: z.string().optional().describe("Phone in international format"),
  language: z.string().optional().describe("ISO 639-1 language code (e.g. 'en')"),
  email: z.string().email().describe("Attendee email address. Must be a real, known email — never guess or fabricate."),
};

export async function addBookingAttendee(params: {
  bookingUid: string;
  name: string;
  timeZone: string;
  phoneNumber?: string;
  language?: string;
  email: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.timeZone = params.timeZone;
    if (params.phoneNumber !== undefined) body.phoneNumber = params.phoneNumber;
    if (params.language !== undefined) body.language = params.language;
    body.email = params.email;
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/attendees`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("add_booking_attendee", err);
  }
}

export const getBookingAttendeeSchema = {
  bookingUid: z.string().describe("Booking UID"),
  attendeeId: z.number().int().describe("Attendee ID. Use get_booking_attendees to find this."),
};

export async function getBookingAttendee(params: {
  bookingUid: string;
  attendeeId: number;
}) {
  try {
    const uid = sanitizePathSegment(params.bookingUid);
    const data = await calApi(`bookings/${uid}/attendees/${params.attendeeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_booking_attendee", err);
  }
}
