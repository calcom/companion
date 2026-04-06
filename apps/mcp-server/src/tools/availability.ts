import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getAvailabilitySchema = {
  start: z.string().describe("Range start, ISO 8601 (e.g. 2024-08-13)"),
  end: z.string().describe("Range end, ISO 8601 (e.g. 2024-08-14)"),
  timeZone: z.string().optional().describe("IANA time zone (e.g. America/New_York)"),
  eventTypeId: z.number().int().optional().describe("Event type ID"),
  eventTypeSlug: z.string().optional().describe("Event type slug"),
  username: z.string().optional().describe("Username"),
  teamSlug: z.string().optional().describe("Team slug"),
  organizationSlug: z.string().optional().describe("Organization slug"),
  usernames: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Comma-separated or array of usernames"),
  duration: z.number().int().optional().describe("Slot duration in minutes"),
  format: z.string().optional().describe("Response format"),
  bookingUidToReschedule: z.string().optional().describe("Booking UID being rescheduled (unlocks its slot)"),
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
