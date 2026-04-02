import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgMembershipsSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgMemberships(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/memberships`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_memberships", err);
  }
}

export const createOrgMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number(),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).describe("If you are platform customer then managed users should only have MEMBER role."),
  disableImpersonation: z.boolean().optional(),
};

export async function createOrgMembership(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/memberships`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_membership", err);
  }
}

export const getOrgMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function getOrgMembership(params: {
  orgId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/memberships/${params.membershipId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_membership", err);
  }
}

export const deleteOrgMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  membershipId: z.number().int().describe("membershipId"),
};

export async function deleteOrgMembership(params: {
  orgId: number;
  membershipId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/memberships/${params.membershipId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_membership", err);
  }
}

export const updateOrgMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  membershipId: z.number().int().describe("membershipId"),
  accepted: z.boolean().optional(),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional(),
  disableImpersonation: z.boolean().optional(),
};

export async function updateOrgMembership(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/memberships/${params.membershipId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_membership", err);
  }
}
