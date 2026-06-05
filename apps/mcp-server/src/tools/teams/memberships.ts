import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

// ── Get Team Memberships ──

export const getTeamMembershipsSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
  take: z.number().int().min(1).max(250).optional().describe("Max results to return (1-250)"),
  skip: z.number().int().min(0).optional().describe("Results to skip (offset, min 0)"),
  emails: z
    .array(z.string().email())
    .max(20)
    .optional()
    .describe("Filter team memberships by email address (max 20 emails)"),
};

export async function getTeamMemberships(params: {
  teamId: number;
  take?: number;
  skip?: number;
  emails?: string[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.emails !== undefined) qp.emails = params.emails.join(",");
    const data = await calApi(`teams/${params.teamId}/memberships`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_team_memberships", err);
  }
}

// ── Get Team Membership ──

export const getTeamMembershipSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
  membershipId: z
    .number()
    .int()
    .describe("Membership ID. Use get_team_memberships to find this — never guess."),
};

export async function getTeamMembership(params: { teamId: number; membershipId: number }) {
  try {
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_team_membership", err);
  }
}

// ── Create Team Membership ──

export const createTeamMembershipSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
  userId: z
    .number()
    .describe(
      "User ID of the person to add. Must be a real user ID — ask the user for this, never guess."
    ),
  accepted: z.boolean().optional().describe("Whether accepted"),
  role: z
    .enum(["MEMBER", "OWNER", "ADMIN"])
    .optional()
    .describe("Role to assign (defaults to MEMBER)"),
  disableImpersonation: z.boolean().optional().describe("Disable impersonation"),
};

export async function createTeamMembership(params: {
  teamId: number;
  userId: number;
  accepted?: boolean;
  role?: "MEMBER" | "OWNER" | "ADMIN";
  disableImpersonation?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.userId = params.userId;
    if (params.accepted !== undefined) body.accepted = params.accepted;
    if (params.role !== undefined) body.role = params.role;
    if (params.disableImpersonation !== undefined)
      body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`teams/${params.teamId}/memberships`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_team_membership", err);
  }
}

// ── Update Team Membership ──

export const updateTeamMembershipSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
  membershipId: z
    .number()
    .int()
    .describe("Membership ID. Use get_team_memberships to find this — never guess."),
  accepted: z.boolean().optional().describe("Whether accepted"),
  role: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional().describe("New role"),
  disableImpersonation: z.boolean().optional().describe("Disable impersonation"),
};

export async function updateTeamMembership(params: {
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
    if (params.disableImpersonation !== undefined)
      body.disableImpersonation = params.disableImpersonation;
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`, {
      method: "PATCH",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("update_team_membership", err);
  }
}

// ── Delete Team Membership ──

export const deleteTeamMembershipSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
  membershipId: z
    .number()
    .int()
    .describe("Membership ID. Use get_team_memberships to find this — never guess."),
};

export async function deleteTeamMembership(params: { teamId: number; membershipId: number }) {
  try {
    const data = await calApi(`teams/${params.teamId}/memberships/${params.membershipId}`, {
      method: "DELETE",
    });
    return ok(data);
  } catch (err) {
    return handleError("delete_team_membership", err);
  }
}

// ── Create Team Invite ──

export const createTeamInviteSchema = {
  teamId: z
    .number()
    .int()
    .describe("Team ID. Use get_me or list the user's teams to find this — never guess."),
};

export async function createTeamInvite(params: { teamId: number }) {
  try {
    const data = await calApi(`teams/${params.teamId}/invite`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("create_team_invite", err);
  }
}
