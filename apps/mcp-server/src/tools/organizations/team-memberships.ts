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

export const getOrgTeamMembershipsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamMemberships(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/memberships`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_memberships", err);
  }
}

export const createOrgTeamMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  userId: z.number(),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]),
  disableImpersonation: z.boolean().optional(),
};

export async function createOrgTeamMembership(params: {
  orgId: number;
  teamId: number;
  userId: number;
  accepted?: boolean;
  role: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.userId = params.userId;
    if (params.accepted !== undefined) body.accepted = params.accepted;
    body.role = params.role;
    if (params.disableImpersonation !== undefined) body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/memberships`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_membership", err);
  }
}

export const getOrgTeamMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function getOrgTeamMembership(params: {
  orgId: number;
  teamId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/memberships/${params.membershipId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_membership", err);
  }
}

export const deleteOrgTeamMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function deleteOrgTeamMembership(params: {
  orgId: number;
  teamId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/memberships/${params.membershipId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_membership", err);
  }
}

export const updateOrgTeamMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  membershipId: z.number().int().describe("membershipId"),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional(),
  disableImpersonation: z.boolean().optional(),
};

export async function updateOrgTeamMembership(params: {
  orgId: number;
  teamId: number;
  membershipId: number;
  accepted?: boolean;
  role?: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.accepted !== undefined) body.accepted = params.accepted;
    if (params.role !== undefined) body.role = params.role;
    if (params.disableImpersonation !== undefined) body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/memberships/${params.membershipId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_membership", err);
  }
}
