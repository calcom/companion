import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getBookingsSchema = {
  status: z.string().optional().describe("Filter: upcoming, past, cancelled, etc."),
  attendeeEmail: z.string().email().optional().describe("Filter by attendee email"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  take: z.number().int().optional().describe("Max results to return"),
  skip: z.number().int().optional().describe("Results to skip (offset)"),
};

export async function getBookings(params: {
  status?: string;
  attendeeEmail?: string;
  eventTypeId?: number;
  take?: number;
  skip?: number;
}) {
  try {
    const data = await calApi("bookings", { params });
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
  eventTypeId: z.number().int().optional().describe("Event type ID. Required unless eventTypeSlug + username are provided."),
  eventTypeSlug: z.string().optional().describe("Event type slug (e.g. '15min'). Use with username or teamSlug instead of eventTypeId."),
  username: z.string().optional().describe("Event owner username. Use with eventTypeSlug."),
  teamSlug: z.string().optional().describe("Team slug. Use with eventTypeSlug for team events."),
  organizationSlug: z.string().optional().describe("Organization slug. Use with eventTypeSlug."),
  start: z.string().describe("Start time, ISO 8601 (e.g. 2024-08-13T09:00:00Z)"),
  attendee: z
    .object({
      name: z.string().describe("Full name"),
      email: z.string().email().describe("Email address"),
      timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
    })
    .describe("Attendee details"),
  metadata: z.record(z.unknown()).optional().describe("Metadata key-value pairs"),
};

export async function createBooking(params: {
  eventTypeId?: number;
  eventTypeSlug?: string;
  username?: string;
  teamSlug?: string;
  organizationSlug?: string;
  start: string;
  attendee: { name: string; email: string; timeZone: string };
  metadata?: Record<string, unknown>;
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
    if (params.metadata) body.metadata = params.metadata;
    const data = await calApi("bookings", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_booking", err);
  }
}

export const rescheduleBookingSchema = {
  bookingUid: z.string().describe("Booking UID"),
  start: z.string().optional().describe("New start time, ISO 8601"),
  rescheduleReason: z.string().optional().describe("Reason for rescheduling"),
};

export async function rescheduleBooking(params: {
  bookingUid: string;
  start?: string;
  rescheduleReason?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.start) body.start = params.start;
    if (params.rescheduleReason) body.rescheduleReason = params.rescheduleReason;
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
};

export async function cancelBooking(params: { bookingUid: string; cancellationReason?: string }) {
  try {
    const body: Record<string, unknown> = {};
    if (params.cancellationReason) body.cancellationReason = params.cancellationReason;
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
    email: z.string(),
    absent: z.boolean(),
  })).optional().describe("Attendees with absent status"),
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
  email: z.string().email().describe("Attendee email"),
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
  attendeeId: z.number().int().describe("Attendee ID"),
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
