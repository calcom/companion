import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgMembershipsSchema = {
  orgId: z.number().int().describe("Organization ID"),
  take: z.number().optional().describe("Max results to return"),
  skip: z.number().optional().describe("Results to skip (offset)"),
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
  orgId: z.number().int().describe("Organization ID"),
  userId: z.number().describe("User ID of the person to add. Must be a real user ID from the system — never guess."),
  accepted: z.boolean().optional().describe("Whether accepted"),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).describe("Role (managed users: MEMBER only)"),
  disableImpersonation: z.boolean().optional().describe("Disable impersonation"),
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
  orgId: z.number().int().describe("Organization ID"),
  membershipId: z.number().int().describe("Membership ID"),
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
  orgId: z.number().int().describe("Organization ID"),
  membershipId: z.number().int().describe("Membership ID"),
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
  orgId: z.number().int().describe("Organization ID"),
  membershipId: z.number().int().describe("Membership ID"),
  accepted: z.boolean().optional().describe("Whether accepted"),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional().describe("New role"),
  disableImpersonation: z.boolean().optional().describe("Disable impersonation"),
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
