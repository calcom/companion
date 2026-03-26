import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { CalApiError } from "../../utils/errors.js";

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

export const getOrgTeamBookingsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  status: z.array(z.enum(["upcoming", "recurring", "past", "cancelled", "unconfirmed"])).describe("Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma.").optional(),
  attendeeEmail: z.string().describe("Filter bookings by the attendee's email address.").optional(),
  attendeeName: z.string().describe("Filter bookings by the attendee's name.").optional(),
  bookingUid: z.string().describe("Filter bookings by the booking Uid.").optional(),
  eventTypeIds: z.string().describe("Filter bookings by event type ids belonging to the team. Event type ids must be separated by a comma.").optional(),
  eventTypeId: z.string().describe("Filter bookings by event type id belonging to the team.").optional(),
  afterStart: z.string().describe("Filter bookings with start after this date string.").optional(),
  beforeEnd: z.string().describe("Filter bookings with end before this date string.").optional(),
  sortStart: z.enum(["asc", "desc"]).describe("Sort results by their start time in ascending or descending order.").optional(),
  sortEnd: z.enum(["asc", "desc"]).describe("Sort results by their end time in ascending or descending order.").optional(),
  sortCreated: z.enum(["asc", "desc"]).describe("Sort results by their creation time (when booking was made) in ascending or descending order.").optional(),
  take: z.number().describe("The number of items to return").optional(),
  skip: z.number().describe("The number of items to skip").optional(),
};

export async function getOrgTeamBookings(params: {
  orgId: number;
  teamId: number;
  status?: "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed"[];
  attendeeEmail?: string;
  attendeeName?: string;
  bookingUid?: string;
  eventTypeIds?: string;
  eventTypeId?: string;
  afterStart?: string;
  beforeEnd?: string;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
  sortCreated?: "asc" | "desc";
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.status !== undefined) qp.status = params.status;
    if (params.attendeeEmail !== undefined) qp.attendeeEmail = params.attendeeEmail;
    if (params.attendeeName !== undefined) qp.attendeeName = params.attendeeName;
    if (params.bookingUid !== undefined) qp.bookingUid = params.bookingUid;
    if (params.eventTypeIds !== undefined) qp.eventTypeIds = params.eventTypeIds;
    if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
    if (params.afterStart !== undefined) qp.afterStart = params.afterStart;
    if (params.beforeEnd !== undefined) qp.beforeEnd = params.beforeEnd;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    if (params.sortCreated !== undefined) qp.sortCreated = params.sortCreated;
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_bookings", err);
  }
}

export const getOrgTeamBookingReferencesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  bookingUid: z.string().describe("bookingUid"),
  type: z.enum(["google_calendar", "office365_calendar", "daily_video", "google_video", "office365_video", "zoom_video"]).describe("Filter booking references by type").optional(),
};

export async function getOrgTeamBookingReferences(params: {
  orgId: number;
  teamId: number;
  bookingUid: string;
  type?: "google_calendar" | "office365_calendar" | "daily_video" | "google_video" | "office365_video" | "zoom_video";
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.type !== undefined) qp.type = params.type;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/bookings/${params.bookingUid}/references`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_booking_references", err);
  }
}
