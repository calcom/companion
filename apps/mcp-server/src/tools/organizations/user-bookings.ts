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

export const getOrgUserBookingsSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  status: z.array(z.enum(["upcoming", "recurring", "past", "cancelled", "unconfirmed"])).describe("Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma.").optional(),
  attendeeEmail: z.string().describe("Filter bookings by the attendee's email address.").optional(),
  attendeeName: z.string().describe("Filter bookings by the attendee's name.").optional(),
  bookingUid: z.string().describe("Filter bookings by the booking Uid.").optional(),
  eventTypeIds: z.string().describe("Filter bookings by event type ids belonging to the user. Event type ids must be separated by a comma.").optional(),
  eventTypeId: z.string().describe("Filter bookings by event type id belonging to the user.").optional(),
  teamsIds: z.string().describe("Filter bookings by team ids that user is part of. Team ids must be separated by a comma.").optional(),
  teamId: z.string().describe("Filter bookings by team id that user is part of").optional(),
  afterStart: z.string().describe("Filter bookings with start after this date string.").optional(),
  beforeEnd: z.string().describe("Filter bookings with end before this date string.").optional(),
  afterCreatedAt: z.string().describe("Filter bookings that have been created after this date string.").optional(),
  beforeCreatedAt: z.string().describe("Filter bookings that have been created before this date string.").optional(),
  afterUpdatedAt: z.string().describe("Filter bookings that have been updated after this date string.").optional(),
  beforeUpdatedAt: z.string().describe("Filter bookings that have been updated before this date string.").optional(),
  sortStart: z.enum(["asc", "desc"]).describe("Sort results by their start time in ascending or descending order.").optional(),
  sortEnd: z.enum(["asc", "desc"]).describe("Sort results by their end time in ascending or descending order.").optional(),
  sortCreated: z.enum(["asc", "desc"]).describe("Sort results by their creation time (when booking was made) in ascending or descending order.").optional(),
  sortUpdatedAt: z.enum(["asc", "desc"]).describe("Sort results by their updated time (for example when booking status changes) in ascending or descending order.").optional(),
  take: z.number().describe("The number of items to return").optional(),
  skip: z.number().describe("The number of items to skip").optional(),
};

export async function getOrgUserBookings(params: {
  orgId: number;
  userId: number;
  status?: "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed"[];
  attendeeEmail?: string;
  attendeeName?: string;
  bookingUid?: string;
  eventTypeIds?: string;
  eventTypeId?: string;
  teamsIds?: string;
  teamId?: string;
  afterStart?: string;
  beforeEnd?: string;
  afterCreatedAt?: string;
  beforeCreatedAt?: string;
  afterUpdatedAt?: string;
  beforeUpdatedAt?: string;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
  sortCreated?: "asc" | "desc";
  sortUpdatedAt?: "asc" | "desc";
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
    if (params.teamsIds !== undefined) qp.teamsIds = params.teamsIds;
    if (params.teamId !== undefined) qp.teamId = params.teamId;
    if (params.afterStart !== undefined) qp.afterStart = params.afterStart;
    if (params.beforeEnd !== undefined) qp.beforeEnd = params.beforeEnd;
    if (params.afterCreatedAt !== undefined) qp.afterCreatedAt = params.afterCreatedAt;
    if (params.beforeCreatedAt !== undefined) qp.beforeCreatedAt = params.beforeCreatedAt;
    if (params.afterUpdatedAt !== undefined) qp.afterUpdatedAt = params.afterUpdatedAt;
    if (params.beforeUpdatedAt !== undefined) qp.beforeUpdatedAt = params.beforeUpdatedAt;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    if (params.sortCreated !== undefined) qp.sortCreated = params.sortCreated;
    if (params.sortUpdatedAt !== undefined) qp.sortUpdatedAt = params.sortUpdatedAt;
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_bookings", err);
  }
}
