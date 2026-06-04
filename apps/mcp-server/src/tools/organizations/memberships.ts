import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgMembershipsSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  take: z.number().int().max(100).optional().describe("Max results to return (max 100)"),
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
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().optional().describe("User ID of the person to add. Provide userId OR email, not both. Use get_org_users to find this — never guess."),
  email: z.string().email().optional().describe("Email of an existing Cal.com user to invite. Provide email OR userId, not both. Triggers the invite flow (auto-accept or pending based on org settings)."),
  accepted: z.boolean().optional().describe("Whether accepted"),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).describe("Role (managed users: MEMBER only)"),
  disableImpersonation: z.boolean().optional().describe("Disable impersonation"),
};

export async function createOrgMembership(params: {
  orgId: number;
  userId?: number;
  email?: string;
  accepted?: boolean;
  role: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  if ((params.userId === undefined) === (params.email === undefined)) {
    return {
      content: [{ type: "text" as const, text: "Error: Provide exactly one of userId or email." }],
      isError: true as const,
    };
  }
  try {
    const body: Record<string, unknown> = {};
    if (params.userId !== undefined) body.userId = params.userId;
    if (params.email !== undefined) body.email = params.email;
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
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  membershipId: z.number().int().describe("Membership ID. Use get_org_memberships to find this."),
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
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  membershipId: z.number().int().describe("Membership ID. Use get_org_memberships to find this."),
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
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  membershipId: z.number().int().describe("Membership ID. Use get_org_memberships to find this."),
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
