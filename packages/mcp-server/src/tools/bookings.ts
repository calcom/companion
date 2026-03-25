import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(`[${tag}] ${err.status}: ${err.message}`);
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

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
    const data = await calApi(`bookings/${params.bookingUid}`);
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
    const data = await calApi(`bookings/${params.bookingUid}/reschedule`, { method: "POST", body });
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
    const data = await calApi(`bookings/${params.bookingUid}/cancel`, { method: "POST", body });
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
    const data = await calApi(`bookings/${params.bookingUid}/confirm`, {
      method: "POST",
      body: {},
    });
    return ok(data);
  } catch (err) {
    return handleError("confirm_booking", err);
  }
}
