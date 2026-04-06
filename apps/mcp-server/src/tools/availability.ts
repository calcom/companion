import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getAvailabilitySchema = {
  start: z.string().describe("Range start in UTC, ISO 8601 (e.g. '2024-08-13' or '2024-08-13T09:00:00Z')"),
  end: z.string().describe("Range end in UTC, ISO 8601 (e.g. '2024-08-14' or '2024-08-14T18:00:00Z')"),
  timeZone: z.string().optional().describe("IANA time zone for returned slots (e.g. America/New_York). Defaults to UTC."),
  eventTypeId: z.number().int().optional().describe("Event type ID. Use this OR (eventTypeSlug + username) OR (eventTypeSlug + teamSlug)."),
  eventTypeSlug: z.string().optional().describe("Event type slug. Must be combined with username (individual) or teamSlug (team)."),
  username: z.string().optional().describe("Username of the host whose availability you are checking. Required with eventTypeSlug for individual event types."),
  teamSlug: z.string().optional().describe("Team slug. Required with eventTypeSlug for team event types."),
  organizationSlug: z.string().optional().describe("Organization slug, needed when the user/team is within an organization."),
  usernames: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Comma-separated or array of usernames for dynamic events (min 2). organizationSlug is needed only if users belong to an org."),
  duration: z.number().int().optional().describe("Desired slot duration in minutes (for variable-duration or dynamic events, defaults to 30)"),
  format: z.string().optional().describe("Response format: 'range' (start+end) or 'time' (start only)"),
  bookingUidToReschedule: z.string().optional().describe("Booking UID being rescheduled — ensures original time appears in available slots"),
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
