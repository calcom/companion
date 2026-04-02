import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { sanitizePathSegment } from "../utils/path-sanitizer.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getBookingsSchema = {
  status: z
    .string()
    .optional()
    .describe("Filter by booking status (e.g. upcoming, past, cancelled)"),
  attendeeEmail: z.string().email().optional().describe("Filter by attendee email address"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  take: z.number().int().optional().describe("Number of results to return (pagination limit)"),
  skip: z.number().int().optional().describe("Number of results to skip (pagination offset)"),
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
  bookingUid: z.string().describe("The unique identifier of the booking"),
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
  eventTypeId: z.number().int().describe("The ID of the event type to book"),
  start: z.string().describe("Start time in ISO 8601 format (e.g. 2024-08-13T09:00:00Z)"),
  attendee: z
    .object({
      name: z.string().describe("Attendee full name"),
      email: z.string().email().describe("Attendee email address"),
      timeZone: z.string().describe("Attendee IANA time zone (e.g. America/New_York)"),
    })
    .describe("Attendee information"),
  metadata: z.record(z.unknown()).optional().describe("Optional metadata key-value pairs"),
};

export async function createBooking(params: {
  eventTypeId: number;
  start: string;
  attendee: { name: string; email: string; timeZone: string };
  metadata?: Record<string, unknown>;
}) {
  try {
    const body: Record<string, unknown> = {
      eventTypeId: params.eventTypeId,
      start: params.start,
      attendee: params.attendee,
    };
    if (params.metadata) body.metadata = params.metadata;
    const data = await calApi("bookings", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_booking", err);
  }
}

export const rescheduleBookingSchema = {
  bookingUid: z.string().describe("The unique identifier of the booking to reschedule"),
  start: z.string().optional().describe("New start time in ISO 8601 format"),
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
  bookingUid: z.string().describe("The unique identifier of the booking to cancel"),
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
  bookingUid: z.string().describe("The unique identifier of the booking to confirm"),
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
  bookingUid: z.string().describe("bookingUid"),
  host: z.boolean().describe("Whether the host was absent").optional(),
  attendees: z.array(z.object({
    email: z.string(),
    absent: z.boolean(),
  })).optional(),
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
  bookingUid: z.string().describe("bookingUid"),
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
  bookingUid: z.string().describe("bookingUid"),
  name: z.string().describe("The name of the attendee."),
  timeZone: z.string().describe("The time zone of the attendee."),
  phoneNumber: z.string().describe("The phone number of the attendee in international format.").optional(),
  language: z.enum(["ar", "ca", "de", "es", "eu", "he", "id", "ja", "lv", "pl", "ro", "sr", "th", "vi", "az", "cs", "el", "es-419", "fi", "hr", "it", "km", "nl", "pt", "ru", "sv", "tr", "zh-CN", "bg", "da", "en", "et", "fr", "hu", "iw", "ko", "no", "pt-BR", "sk", "ta", "uk", "zh-TW", "bn"]).describe("The preferred language of the attendee. Used for booking confirmation.").optional(),
  email: z.string().email().describe("The email of the attendee."),
};

export async function addBookingAttendee(params: {
  bookingUid: string;
  name: string;
  timeZone: string;
  phoneNumber?: string;
  language?: "ar" | "ca" | "de" | "es" | "eu" | "he" | "id" | "ja" | "lv" | "pl" | "ro" | "sr" | "th" | "vi" | "az" | "cs" | "el" | "es-419" | "fi" | "hr" | "it" | "km" | "nl" | "pt" | "ru" | "sv" | "tr" | "zh-CN" | "bg" | "da" | "en" | "et" | "fr" | "hu" | "iw" | "ko" | "no" | "pt-BR" | "sk" | "ta" | "uk" | "zh-TW" | "bn";
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
  bookingUid: z.string().describe("bookingUid"),
  attendeeId: z.number().int().describe("attendeeId"),
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
