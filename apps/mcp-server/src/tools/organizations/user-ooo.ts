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

export const getOrgUserOooSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  sortStart: z.enum(["asc", "desc"]).describe("Sort results by their start time in ascending or descending order.").optional(),
  sortEnd: z.enum(["asc", "desc"]).describe("Sort results by their end time in ascending or descending order.").optional(),
};

export async function getOrgUserOoo(params: {
  orgId: number;
  userId: number;
  take?: number;
  skip?: number;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/ooo`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_ooo", err);
  }
}

export const createOrgUserOooSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  start: z.string().describe("The start date and time of the out of office period in ISO 8601 format in UTC timezone."),
  end: z.string().describe("The end date and time of the out of office period in ISO 8601 format in UTC timezone."),
  notes: z.string().describe("Optional notes for the out of office entry.").optional(),
  toUserId: z.number().describe("The ID of the user covering for the out of office period, if applicable.").optional(),
  reason: z.enum(["unspecified", "vacation", "travel", "sick", "public_holiday"]).describe("the reason for the out of office entry, if applicable").optional(),
};

export async function createOrgUserOoo(params: {
  orgId: number;
  userId: number;
  start: string;
  end: string;
  notes?: string;
  toUserId?: number;
  reason?: "unspecified" | "vacation" | "travel" | "sick" | "public_holiday";
}) {
  try {
    const body: Record<string, unknown> = {};
    body.start = params.start;
    body.end = params.end;
    if (params.notes !== undefined) body.notes = params.notes;
    if (params.toUserId !== undefined) body.toUserId = params.toUserId;
    if (params.reason !== undefined) body.reason = params.reason;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/ooo`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_user_ooo", err);
  }
}

export const updateOrgUserOooSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  oooId: z.number().int().describe("oooId"),
  start: z.string().describe("The start date and time of the out of office period in ISO 8601 format in UTC timezone.").optional(),
  end: z.string().describe("The end date and time of the out of office period in ISO 8601 format in UTC timezone.").optional(),
  notes: z.string().describe("Optional notes for the out of office entry.").optional(),
  toUserId: z.number().describe("The ID of the user covering for the out of office period, if applicable.").optional(),
  reason: z.enum(["unspecified", "vacation", "travel", "sick", "public_holiday"]).describe("the reason for the out of office entry, if applicable").optional(),
};

export async function updateOrgUserOoo(params: {
  orgId: number;
  userId: number;
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
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/ooo/${params.oooId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_user_ooo", err);
  }
}

export const deleteOrgUserOooSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  oooId: z.number().int().describe("oooId"),
};

export async function deleteOrgUserOoo(params: {
  orgId: number;
  userId: number;
  oooId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/ooo/${params.oooId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_user_ooo", err);
  }
}

export const getOrgOooSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  sortStart: z.enum(["asc", "desc"]).describe("Sort results by their start time in ascending or descending order.").optional(),
  sortEnd: z.enum(["asc", "desc"]).describe("Sort results by their end time in ascending or descending order.").optional(),
  email: z.string().describe("Filter ooo entries by the user email address. user must be within your organization.").optional(),
};

export async function getOrgOoo(params: {
  orgId: number;
  take?: number;
  skip?: number;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
  email?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.sortStart !== undefined) qp.sortStart = params.sortStart;
    if (params.sortEnd !== undefined) qp.sortEnd = params.sortEnd;
    if (params.email !== undefined) qp.email = params.email;
    const data = await calApi(`organizations/${params.orgId}/ooo`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_ooo", err);
  }
}
