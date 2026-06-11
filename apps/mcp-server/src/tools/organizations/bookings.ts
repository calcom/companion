import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

const bookingFiltersSchema = {
  status: z.string().optional().describe("Comma-separated statuses: upcoming, recurring, past, cancelled, unconfirmed"),
  attendeeEmail: z.string().email().optional().describe("Filter by attendee email"),
  attendeeName: z.string().optional().describe("Filter by attendee name"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  eventTypeIds: z.string().optional().describe("Comma-separated event type IDs (e.g. '100,200')"),
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

interface BookingFilterParams {
  status?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  eventTypeId?: number;
  eventTypeIds?: string;
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
}

function buildBookingQueryParams(params: BookingFilterParams): Record<string, string | number | undefined> {
  const qp: Record<string, string | number | undefined> = {};
  if (params.status !== undefined) qp.status = params.status;
  if (params.attendeeEmail !== undefined) qp.attendeeEmail = params.attendeeEmail;
  if (params.attendeeName !== undefined) qp.attendeeName = params.attendeeName;
  if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
  if (params.eventTypeIds !== undefined) qp.eventTypeIds = params.eventTypeIds;
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
  return qp;
}

// ── Org Team Bookings ──

export const getOrgTeamBookingsSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  teamId: z.number().int().describe("Team ID within the organization."),
  ...bookingFiltersSchema,
};

export async function getOrgTeamBookings(params: { orgId: number; teamId: number } & BookingFilterParams) {
  try {
    const qp = buildBookingQueryParams(params);
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_bookings", err);
  }
}

// ── Org User Bookings ──

export const getOrgUserBookingsSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().int().describe("User ID of the organization member whose bookings to retrieve."),
  teamId: z.number().int().optional().describe("Filter by team ID"),
  teamsIds: z.string().optional().describe("Comma-separated team IDs (e.g. '50,60')"),
  ...bookingFiltersSchema,
};

export async function getOrgUserBookings(params: { orgId: number; userId: number; teamId?: number; teamsIds?: string } & BookingFilterParams) {
  try {
    const qp = buildBookingQueryParams(params);
    if (params.teamId !== undefined) qp.teamId = params.teamId;
    if (params.teamsIds !== undefined) qp.teamsIds = params.teamsIds;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_bookings", err);
  }
}
