import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

const utcDateTime = z
  .string()
  .regex(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/,
    "Must be an ISO 8601 UTC timestamp in YYYY-MM-DDTHH:mm:ss(.sss)Z format."
  )
  .describe(
    "ISO 8601 UTC timestamp in YYYY-MM-DDTHH:mm:ss(.sss)Z format, such as 2026-09-01T00:00:00.000Z. Date-only and offset timestamps are not accepted."
  );

const reason = z.enum(["unspecified", "vacation", "travel", "sick", "public_holiday"]);

const toUserIdDescription =
  "Optional numeric ID of the user who should receive redirected bookings. Discover this with get_org_memberships, get_team_memberships, or get_my_teams — never guess an ID.";

export const getOooEntriesSchema = {
  take: z
    .number()
    .int()
    .min(1)
    .max(250)
    .optional()
    .describe("Maximum entries to return (1-250, defaults to 250)."),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of entries to skip (offset, defaults to 0)."),
  sortStart: z
    .enum(["asc", "desc"])
    .optional()
    .describe("Sort entries by start time in ascending or descending order."),
  sortEnd: z
    .enum(["asc", "desc"])
    .optional()
    .describe("Sort entries by end time in ascending or descending order."),
};

export async function getOooEntries(params: {
  take?: number;
  skip?: number;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
}) {
  try {
    const qp: Record<string, string | number | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    const data = await calApi("me/ooo", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_ooo_entries", err);
  }
}

export const createOooEntrySchema = {
  start: utcDateTime.describe(
    "Start of the day-granular out-of-office period as an ISO 8601 UTC timestamp in YYYY-MM-DDTHH:mm:ss(.sss)Z format, such as 2026-09-01T00:00:00.000Z. The API normalizes this to 00:00:00.000Z. For a partial-day absence, use update_schedule instead."
  ),
  end: utcDateTime.describe(
    "End of the day-granular out-of-office period as an ISO 8601 UTC timestamp in YYYY-MM-DDTHH:mm:ss(.sss)Z format, such as 2026-09-01T23:59:59.999Z. The API normalizes this to 23:59:59.999Z. For a partial-day absence, use update_schedule instead."
  ),
  notes: z.string().optional().describe("Optional notes for the out-of-office entry."),
  toUserId: z.number().int().optional().describe(toUserIdDescription),
  reason: reason
    .optional()
    .describe(
      "Optional reason: unspecified, vacation, travel, sick, or public_holiday. The API defaults to unspecified when omitted."
    ),
};

export async function createOooEntry(params: {
  start: string;
  end: string;
  notes?: string;
  toUserId?: number;
  reason?: "unspecified" | "vacation" | "travel" | "sick" | "public_holiday";
}) {
  try {
    const body: Record<string, unknown> = {
      start: params.start,
      end: params.end,
    };
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.toUserId !== undefined) body.toUserId = params.toUserId;
    if (params.reason !== undefined) body.reason = params.reason;
    const data = await calApi("me/ooo", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_ooo_entry", err);
  }
}

export const updateOooEntrySchema = {
  oooId: z.number().int().describe("Out-of-office entry ID. Use get_ooo_entries to find it."),
  start: utcDateTime.describe(
    "Optional new start timestamp in ISO 8601 UTC YYYY-MM-DDTHH:mm:ss(.sss)Z format. If start or end is supplied, supply both; the API rejects exactly one. The API normalizes the date to 00:00:00.000Z. For a partial-day absence, use update_schedule instead."
  ),
  end: utcDateTime.describe(
    "Optional new end timestamp in ISO 8601 UTC YYYY-MM-DDTHH:mm:ss(.sss)Z format. If start or end is supplied, supply both; the API rejects exactly one. The API normalizes the date to 23:59:59.999Z. For a partial-day absence, use update_schedule instead."
  ),
  notes: z.string().optional().describe("Optional replacement notes for the out-of-office entry."),
  toUserId: z.number().int().optional().describe(toUserIdDescription),
  reason: reason
    .optional()
    .describe(
      "Optional replacement reason: unspecified, vacation, travel, sick, or public_holiday."
    ),
};

export async function updateOooEntry(params: {
  oooId: number;
  start?: string;
  end?: string;
  notes?: string;
  toUserId?: number;
  reason?: "unspecified" | "vacation" | "travel" | "sick" | "public_holiday";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.start !== undefined) body.start = params.start;
    if (params.end !== undefined) body.end = params.end;
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.toUserId !== undefined) body.toUserId = params.toUserId;
    if (params.reason !== undefined) body.reason = params.reason;
    const data = await calApi(`me/ooo/${params.oooId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_ooo_entry", err);
  }
}

export const deleteOooEntrySchema = {
  oooId: z.number().int().describe("Out-of-office entry ID. Use get_ooo_entries to find it."),
};

export async function deleteOooEntry(params: { oooId: number }) {
  try {
    const data = await calApi(`me/ooo/${params.oooId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_ooo_entry", err);
  }
}
