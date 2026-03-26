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

export const createOrgRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  color: z.string().describe("Color for the role (hex code)").optional(),
  description: z.string().describe("Description of the role").optional(),
  permissions: z.array(z.enum(["*.*", "role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.create", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "organization.create", "organization.read", "organization.listMembers", "organization.listMembersPrivate", "organization.invite", "organization.remove", "organization.manageBilling", "organization.changeMemberRole", "organization.impersonate", "organization.passwordReset", "organization.update", "booking.read", "booking.readOrgBookings", "booking.readRecordings", "booking.update", "booking.readOrgAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "organization.attributes.read", "organization.attributes.update", "organization.attributes.delete", "organization.attributes.create", "organization.attributes.editUsers", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions for this role (format: resource.action). On update, this field replaces the entire permission set for the role (full replace). Use granular permission endpoints for one-by-one changes.").optional(),
  name: z.string().describe("Name of the role"),
};

export async function createOrgRole(params: {
  orgId: number;
  color?: string;
  description?: string;
  permissions?: "*.*" | "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.create" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "organization.create" | "organization.read" | "organization.listMembers" | "organization.listMembersPrivate" | "organization.invite" | "organization.remove" | "organization.manageBilling" | "organization.changeMemberRole" | "organization.impersonate" | "organization.passwordReset" | "organization.update" | "booking.read" | "booking.readOrgBookings" | "booking.readRecordings" | "booking.update" | "booking.readOrgAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "organization.attributes.read" | "organization.attributes.update" | "organization.attributes.delete" | "organization.attributes.create" | "organization.attributes.editUsers" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "watchlist.create" | "watchlist.read" | "watchlist.update" | "watchlist.delete" | "featureOptIn.read" | "featureOptIn.update"[];
  name: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.color !== undefined) body.color = params.color;
    if (params.description !== undefined) body.description = params.description;
    if (params.permissions !== undefined) body.permissions = params.permissions;
    body.name = params.name;
    const data = await calApi(`organizations/${params.orgId}/roles`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_role", err);
  }
}

export const getOrgRolesSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgRoles(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/roles`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_roles", err);
  }
}

export const getOrgRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
};

export async function getOrgRole(params: {
  orgId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_role", err);
  }
}

export const updateOrgRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
  color: z.string().describe("Color for the role (hex code)").optional(),
  description: z.string().describe("Description of the role").optional(),
  permissions: z.array(z.enum(["*.*", "role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.create", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "organization.create", "organization.read", "organization.listMembers", "organization.listMembersPrivate", "organization.invite", "organization.remove", "organization.manageBilling", "organization.changeMemberRole", "organization.impersonate", "organization.passwordReset", "organization.update", "booking.read", "booking.readOrgBookings", "booking.readRecordings", "booking.update", "booking.readOrgAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "organization.attributes.read", "organization.attributes.update", "organization.attributes.delete", "organization.attributes.create", "organization.attributes.editUsers", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions for this role (format: resource.action). On update, this field replaces the entire permission set for the role (full replace). Use granular permission endpoints for one-by-one changes.").optional(),
  name: z.string().describe("Name of the role").optional(),
};

export async function updateOrgRole(params: {
  orgId: number;
  roleId: string;
  color?: string;
  description?: string;
  permissions?: "*.*" | "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.create" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "organization.create" | "organization.read" | "organization.listMembers" | "organization.listMembersPrivate" | "organization.invite" | "organization.remove" | "organization.manageBilling" | "organization.changeMemberRole" | "organization.impersonate" | "organization.passwordReset" | "organization.update" | "booking.read" | "booking.readOrgBookings" | "booking.readRecordings" | "booking.update" | "booking.readOrgAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "organization.attributes.read" | "organization.attributes.update" | "organization.attributes.delete" | "organization.attributes.create" | "organization.attributes.editUsers" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "watchlist.create" | "watchlist.read" | "watchlist.update" | "watchlist.delete" | "featureOptIn.read" | "featureOptIn.update"[];
  name?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.color !== undefined) body.color = params.color;
    if (params.description !== undefined) body.description = params.description;
    if (params.permissions !== undefined) body.permissions = params.permissions;
    if (params.name !== undefined) body.name = params.name;
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_role", err);
  }
}

export const deleteOrgRoleSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
};

export async function deleteOrgRole(params: {
  orgId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_role", err);
  }
}

export const addOrgRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["*.*", "role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.create", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "organization.create", "organization.read", "organization.listMembers", "organization.listMembersPrivate", "organization.invite", "organization.remove", "organization.manageBilling", "organization.changeMemberRole", "organization.impersonate", "organization.passwordReset", "organization.update", "booking.read", "booking.readOrgBookings", "booking.readRecordings", "booking.update", "booking.readOrgAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "organization.attributes.read", "organization.attributes.update", "organization.attributes.delete", "organization.attributes.create", "organization.attributes.editUsers", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to add (format: resource.action)"),
};

export async function addOrgRolePermissions(params: {
  orgId: number;
  roleId: string;
  permissions: "*.*" | "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.create" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "organization.create" | "organization.read" | "organization.listMembers" | "organization.listMembersPrivate" | "organization.invite" | "organization.remove" | "organization.manageBilling" | "organization.changeMemberRole" | "organization.impersonate" | "organization.passwordReset" | "organization.update" | "booking.read" | "booking.readOrgBookings" | "booking.readRecordings" | "booking.update" | "booking.readOrgAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "organization.attributes.read" | "organization.attributes.update" | "organization.attributes.delete" | "organization.attributes.create" | "organization.attributes.editUsers" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "watchlist.create" | "watchlist.read" | "watchlist.update" | "watchlist.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}/permissions`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("add_org_role_permissions", err);
  }
}

export const getOrgRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
};

export async function getOrgRolePermissions(params: {
  orgId: number;
  roleId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}/permissions`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_role_permissions", err);
  }
}

export const replaceOrgRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["*.*", "role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.create", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "organization.create", "organization.read", "organization.listMembers", "organization.listMembersPrivate", "organization.invite", "organization.remove", "organization.manageBilling", "organization.changeMemberRole", "organization.impersonate", "organization.passwordReset", "organization.update", "booking.read", "booking.readOrgBookings", "booking.readRecordings", "booking.update", "booking.readOrgAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "organization.attributes.read", "organization.attributes.update", "organization.attributes.delete", "organization.attributes.create", "organization.attributes.editUsers", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to add (format: resource.action)"),
};

export async function replaceOrgRolePermissions(params: {
  orgId: number;
  roleId: string;
  permissions: "*.*" | "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.create" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "organization.create" | "organization.read" | "organization.listMembers" | "organization.listMembersPrivate" | "organization.invite" | "organization.remove" | "organization.manageBilling" | "organization.changeMemberRole" | "organization.impersonate" | "organization.passwordReset" | "organization.update" | "booking.read" | "booking.readOrgBookings" | "booking.readRecordings" | "booking.update" | "booking.readOrgAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "organization.attributes.read" | "organization.attributes.update" | "organization.attributes.delete" | "organization.attributes.create" | "organization.attributes.editUsers" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "watchlist.create" | "watchlist.read" | "watchlist.update" | "watchlist.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}/permissions`, { method: "PUT", body });
    return ok(data);
  } catch (err) {
    return handleError("replace_org_role_permissions", err);
  }
}

export const removeOrgRolePermissionsSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
  permissions: z.array(z.enum(["*.*", "role.create", "role.read", "role.update", "role.delete", "eventType.create", "eventType.read", "eventType.update", "eventType.delete", "team.create", "team.read", "team.update", "team.delete", "team.invite", "team.remove", "team.listMembers", "team.listMembersPrivate", "team.changeMemberRole", "team.impersonate", "organization.create", "organization.read", "organization.listMembers", "organization.listMembersPrivate", "organization.invite", "organization.remove", "organization.manageBilling", "organization.changeMemberRole", "organization.impersonate", "organization.passwordReset", "organization.update", "booking.read", "booking.readOrgBookings", "booking.readRecordings", "booking.update", "booking.readOrgAuditLogs", "insights.read", "workflow.create", "workflow.read", "workflow.update", "workflow.delete", "organization.attributes.read", "organization.attributes.update", "organization.attributes.delete", "organization.attributes.create", "organization.attributes.editUsers", "routingForm.create", "routingForm.read", "routingForm.update", "routingForm.delete", "webhook.create", "webhook.read", "webhook.update", "webhook.delete", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete", "featureOptIn.read", "featureOptIn.update"])).describe("Permissions to remove (format: resource.action). Supports comma-separated values as well as repeated query params.").optional(),
};

export async function removeOrgRolePermissions(params: {
  orgId: number;
  roleId: string;
  permissions?: "*.*" | "role.create" | "role.read" | "role.update" | "role.delete" | "eventType.create" | "eventType.read" | "eventType.update" | "eventType.delete" | "team.create" | "team.read" | "team.update" | "team.delete" | "team.invite" | "team.remove" | "team.listMembers" | "team.listMembersPrivate" | "team.changeMemberRole" | "team.impersonate" | "organization.create" | "organization.read" | "organization.listMembers" | "organization.listMembersPrivate" | "organization.invite" | "organization.remove" | "organization.manageBilling" | "organization.changeMemberRole" | "organization.impersonate" | "organization.passwordReset" | "organization.update" | "booking.read" | "booking.readOrgBookings" | "booking.readRecordings" | "booking.update" | "booking.readOrgAuditLogs" | "insights.read" | "workflow.create" | "workflow.read" | "workflow.update" | "workflow.delete" | "organization.attributes.read" | "organization.attributes.update" | "organization.attributes.delete" | "organization.attributes.create" | "organization.attributes.editUsers" | "routingForm.create" | "routingForm.read" | "routingForm.update" | "routingForm.delete" | "webhook.create" | "webhook.read" | "webhook.update" | "webhook.delete" | "watchlist.create" | "watchlist.read" | "watchlist.update" | "watchlist.delete" | "featureOptIn.read" | "featureOptIn.update"[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.permissions !== undefined) qp.permissions = params.permissions;
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}/permissions`, { method: "DELETE", params: qp });
    return ok(data);
  } catch (err) {
    return handleError("remove_org_role_permissions", err);
  }
}

export const removeOrgRolePermissionSchema = {
  orgId: z.number().int().describe("orgId"),
  roleId: z.string().describe("roleId"),
  permission: z.string().describe("permission"),
};

export async function removeOrgRolePermission(params: {
  orgId: number;
  roleId: string;
  permission: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/roles/${params.roleId}/permissions/${params.permission}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("remove_org_role_permission", err);
  }
}
