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

export const getAvailabilitySchema = {
  start: z
    .string()
    .describe("Start of the time range (ISO 8601 date or datetime, e.g. 2024-08-13 or 2024-08-13T00:00:00Z)"),
  end: z
    .string()
    .describe("End of the time range (ISO 8601 date or datetime, e.g. 2024-08-14 or 2024-08-14T00:00:00Z)"),
  timeZone: z.string().optional().describe("IANA time zone for the results (e.g. America/New_York)"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  eventTypeSlug: z.string().optional().describe("Filter by event type slug"),
  username: z.string().optional().describe("Filter by a single username"),
  teamSlug: z.string().optional().describe("Filter by team slug"),
  organizationSlug: z.string().optional().describe("Filter by organization slug"),
  usernames: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Comma-separated string or array of usernames"),
  duration: z.number().int().optional().describe("Slot duration in minutes"),
  format: z.string().optional().describe("Response format"),
  bookingUidToReschedule: z.string().optional().describe("Booking UID to reschedule (shows slots that would otherwise be busy)"),
};

export async function getAvailability(params: {
  start: string;
  end: string;
  timeZone?: string;
  eventTypeId?: number;
  eventTypeSlug?: string;
  username?: string;
  teamSlug?: string;
  organizationSlug?: string;
  usernames?: string | string[];
  duration?: number;
  format?: string;
  bookingUidToReschedule?: string;
}) {
  try {
    const queryParams: Record<string, string | number | string[] | undefined> = {
      start: params.start,
      end: params.end,
    };
    if (params.timeZone) queryParams.timeZone = params.timeZone;
    if (params.eventTypeId !== undefined) queryParams.eventTypeId = params.eventTypeId;
    if (params.eventTypeSlug) queryParams.eventTypeSlug = params.eventTypeSlug;
    if (params.username) queryParams.username = params.username;
    if (params.teamSlug) queryParams.teamSlug = params.teamSlug;
    if (params.organizationSlug) queryParams.organizationSlug = params.organizationSlug;
    if (params.usernames !== undefined) {
      queryParams.usernames = Array.isArray(params.usernames)
        ? params.usernames.join(",")
        : params.usernames;
    }
    if (params.duration !== undefined) queryParams.duration = params.duration;
    if (params.format) queryParams.format = params.format;
    if (params.bookingUidToReschedule) queryParams.bookingUidToReschedule = params.bookingUidToReschedule;

    const data = await calApi("slots", { params: queryParams });
    return ok(data);
  } catch (err) {
    return handleError("get_availability", err);
  }
}

// ── New tools (generated) ──

export const reserveSlotSchema = {
  eventTypeId: z.number().describe("The ID of the event type for which slot should be reserved."),
  slotStart: z.string().describe("ISO 8601 datestring in UTC timezone representing available slot."),
  slotDuration: z.number().describe("By default slot duration is equal to event type length, but if you want to reserve a slot for an event type that has a variable length you can specify it here as a number in minutes. If you don't have").optional(),
  reservationDuration: z.number().describe("ONLY for authenticated requests with api key, access token or OAuth credentials (ID + secret).              For how many minutes the slot should be reserved - for this long time noone else can book th").optional(),
};

export async function reserveSlot(params: {
  eventTypeId: number;
  slotStart: string;
  slotDuration?: number;
  reservationDuration?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.eventTypeId = params.eventTypeId;
    body.slotStart = params.slotStart;
    if (params.slotDuration !== undefined) body.slotDuration = params.slotDuration;
    if (params.reservationDuration !== undefined) body.reservationDuration = params.reservationDuration;
    const data = await calApi("slots/reservations", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("reserve_slot", err);
  }
}

export const getSlotReservationSchema = {
  uid: z.string().describe("uid"),
};

export async function getSlotReservation(params: {
  uid: string;
}) {
  try {
    const data = await calApi(`slots/reservations/${params.uid}`);
    return ok(data);
  } catch (err) {
    return handleError("get_slot_reservation", err);
  }
}

export const updateSlotReservationSchema = {
  uid: z.string().describe("uid"),
  eventTypeId: z.number().describe("The ID of the event type for which slot should be reserved."),
  slotStart: z.string().describe("ISO 8601 datestring in UTC timezone representing available slot."),
  slotDuration: z.number().describe("By default slot duration is equal to event type length, but if you want to reserve a slot for an event type that has a variable length you can specify it here as a number in minutes. If you don't have").optional(),
  reservationDuration: z.number().describe("ONLY for authenticated requests with api key, access token or OAuth credentials (ID + secret).              For how many minutes the slot should be reserved - for this long time noone else can book th").optional(),
};

export async function updateSlotReservation(params: {
  uid: string;
  eventTypeId: number;
  slotStart: string;
  slotDuration?: number;
  reservationDuration?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.eventTypeId = params.eventTypeId;
    body.slotStart = params.slotStart;
    if (params.slotDuration !== undefined) body.slotDuration = params.slotDuration;
    if (params.reservationDuration !== undefined) body.reservationDuration = params.reservationDuration;
    const data = await calApi(`slots/reservations/${params.uid}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_slot_reservation", err);
  }
}

export const deleteSlotReservationSchema = {
  uid: z.string().describe("uid"),
};

export async function deleteSlotReservation(params: {
  uid: string;
}) {
  try {
    const data = await calApi(`slots/reservations/${params.uid}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_slot_reservation", err);
  }
}
