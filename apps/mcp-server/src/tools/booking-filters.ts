import { z } from "zod";

export const bookingFiltersSchema = {
  status: z
    .string()
    .optional()
    .describe("Comma-separated statuses: upcoming, recurring, past, cancelled, unconfirmed"),
  attendeeEmail: z.string().email().optional().describe("Filter by attendee email"),
  attendeeName: z.string().optional().describe("Filter by attendee name"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  eventTypeIds: z.string().optional().describe("Comma-separated event type IDs (e.g. '100,200')"),
  afterStart: z.string().optional().describe("Filter bookings starting after this ISO 8601 date"),
  beforeEnd: z.string().optional().describe("Filter bookings ending before this ISO 8601 date"),
  afterCreatedAt: z
    .string()
    .optional()
    .describe("Filter bookings created after this ISO 8601 date"),
  beforeCreatedAt: z
    .string()
    .optional()
    .describe("Filter bookings created before this ISO 8601 date"),
  afterUpdatedAt: z
    .string()
    .optional()
    .describe("Filter bookings updated after this ISO 8601 date"),
  beforeUpdatedAt: z
    .string()
    .optional()
    .describe("Filter bookings updated before this ISO 8601 date"),
  bookingUid: z.string().optional().describe("Filter by booking UID"),
  sortStart: z.enum(["asc", "desc"]).optional().describe("Sort by start time"),
  sortEnd: z.enum(["asc", "desc"]).optional().describe("Sort by end time"),
  sortCreated: z.enum(["asc", "desc"]).optional().describe("Sort by creation time"),
  sortUpdatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by updated time"),
  take: z.number().int().optional().describe("Max results to return (default 100, max 250)"),
  skip: z.number().int().optional().describe("Results to skip (offset)"),
};

export const bookingTeamFiltersSchema = {
  teamId: z.number().int().optional().describe("Filter by team ID"),
  teamsIds: z.string().optional().describe("Comma-separated team IDs (e.g. '50,60')"),
};

const bookingFiltersZodObject = z.object(bookingFiltersSchema);
const bookingTeamFiltersZodObject = z.object(bookingTeamFiltersSchema);

export type BookingFilterParams = z.infer<typeof bookingFiltersZodObject>;
export type BookingTeamFilterParams = z.infer<typeof bookingTeamFiltersZodObject>;

type BookingQueryParamValue = string | number;
type BookingQueryParams = Record<string, BookingQueryParamValue | undefined>;

const bookingFilterParamKeys = Object.keys(bookingFiltersSchema) as (keyof BookingFilterParams)[];
const bookingTeamFilterParamKeys = Object.keys(
  bookingTeamFiltersSchema
) as (keyof BookingTeamFilterParams)[];

export function buildBookingQueryParams(
  params: BookingFilterParams & Partial<BookingTeamFilterParams>,
  options: { includeTeamFilters?: boolean } = {}
): BookingQueryParams {
  const qp: BookingQueryParams = {};

  for (const key of bookingFilterParamKeys) {
    const value = params[key];
    if (value !== undefined) qp[key] = value;
  }

  if (options.includeTeamFilters) {
    for (const key of bookingTeamFilterParamKeys) {
      const value = params[key];
      if (value !== undefined) qp[key] = value;
    }
  }

  return qp;
}
