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

export const createOrgTeamRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  color: z.string().describe("Color for the role (hex code)").optional(),
  description: z.string().describe("Description of the role").optional(),
  permissions: z.array(z.enum(["role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "booking.read", "booking.readTeamBookings", "booking.readRecordings", "booking.update", "booking.readTeamAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions for this role (format: resource.action). On update, this field replaces the entire permission set for the role (full replace). Use granular permission endpoints for one-by-one changes.").optional(),
  name: z.string().describe("Name of the role"),
};

export async function createOrgTeamRole(params: {
  orgId: number;
  teamId: number;
  color?: string;
  description?: string;
  permissions?: "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "booking.read" | "booking.readTeamBookings" | "booking.readRecordings" | "booking.update" | "booking.readTeamAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "featureOptIn.read" | "featureOptIn.update"[];
  name: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.color !== undefined) body.color = params.color;
    if (params.description !== undefined) body.description = params.description;
    if (params.permissions !== undefined) body.permissions = params.permissions;
    body.name = params.name;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_role", err);
  }
}

export const getOrgTeamRolesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamRoles(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_roles", err);
  }
}

export const getOrgTeamRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
};

export async function getOrgTeamRole(params: {
  orgId: number;
  teamId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_role", err);
  }
}

export const updateOrgTeamRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
  color: z.string().describe("Color for the role (hex code)").optional(),
  description: z.string().describe("Description of the role").optional(),
  permissions: z.array(z.enum(["role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "booking.read", "booking.readTeamBookings", "booking.readRecordings", "booking.update", "booking.readTeamAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions for this role (format: resource.action). On update, this field replaces the entire permission set for the role (full replace). Use granular permission endpoints for one-by-one changes.").optional(),
  name: z.string().describe("Name of the role").optional(),
};

export async function updateOrgTeamRole(params: {
  orgId: number;
  teamId: number;
  roleId: string;
  color?: string;
  description?: string;
  permissions?: "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "booking.read" | "booking.readTeamBookings" | "booking.readRecordings" | "booking.update" | "booking.readTeamAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "featureOptIn.read" | "featureOptIn.update"[];
  name?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.color !== undefined) body.color = params.color;
    if (params.description !== undefined) body.description = params.description;
    if (params.permissions !== undefined) body.permissions = params.permissions;
    if (params.name !== undefined) body.name = params.name;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_role", err);
  }
}

export const deleteOrgTeamRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
};

export async function deleteOrgTeamRole(params: {
  orgId: number;
  teamId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_role", err);
  }
}

export const addOrgTeamRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "booking.read", "booking.readTeamBookings", "booking.readRecordings", "booking.update", "booking.readTeamAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to add (format: resource.action)"),
};

export async function addOrgTeamRolePermissions(params: {
  orgId: number;
  teamId: number;
  roleId: string;
  permissions: "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "booking.read" | "booking.readTeamBookings" | "booking.readRecordings" | "booking.update" | "booking.readTeamAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}/permissions`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("add_org_team_role_permissions", err);
  }
}

export const getOrgTeamRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
};

export async function getOrgTeamRolePermissions(params: {
  orgId: number;
  teamId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}/permissions`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_role_permissions", err);
  }
}

export const replaceOrgTeamRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "booking.read", "booking.readTeamBookings", "booking.readRecordings", "booking.update", "booking.readTeamAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to add (format: resource.action)"),
};

export async function replaceOrgTeamRolePermissions(params: {
  orgId: number;
  teamId: number;
  roleId: string;
  permissions: "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "booking.read" | "booking.readTeamBookings" | "booking.readRecordings" | "booking.update" | "booking.readTeamAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}/permissions`, { method: "PUT", body });
    return ok(data);
  } catch (err) {
    return handleError("replace_org_team_role_permissions", err);
  }
}

export const removeOrgTeamRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "booking.read", "booking.readTeamBookings", "booking.readRecordings", "booking.update", "booking.readTeamAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to remove (format: resource.action). Supports comma-separated values as well as repeated query params.").optional(),
};

export async function removeOrgTeamRolePermissions(params: {
  orgId: number;
  teamId: number;
  roleId: string;
  permissions?: "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "booking.read" | "booking.readTeamBookings" | "booking.readRecordings" | "booking.update" | "booking.readTeamAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.permissions !== undefined) qp.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}/permissions`, { method: "DELETE", params: qp });
    return ok(data);
  } catch (err) {
    return handleError("remove_org_team_role_permissions", err);
  }
}

export const removeOrgTeamRolePermissionSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  roleId: z.string().describe("roleId"),
  permission: z.string().describe("permission"),
};

export async function removeOrgTeamRolePermission(params: {
  orgId: number;
  teamId: number;
  roleId: string;
  permission: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/roles/${params.roleId}/permissions/${params.permission}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("remove_org_team_role_permission", err);
  }
}
