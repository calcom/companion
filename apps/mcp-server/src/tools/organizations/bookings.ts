import { z } from "zod";
import {
  type BookingFilterParams,
  type BookingTeamFilterParams,
  bookingFiltersSchema,
  bookingTeamFiltersSchema,
  buildBookingQueryParams,
} from "../booking-filters.js";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

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
  ...bookingTeamFiltersSchema,
  ...bookingFiltersSchema,
};

export async function getOrgUserBookings(params: { orgId: number; userId: number } & BookingFilterParams & BookingTeamFilterParams) {
  try {
    const qp = buildBookingQueryParams(params, { includeTeamFilters: true });
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/bookings`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_bookings", err);
  }
}
