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

export const getOrgUsersSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("The number of items to return").optional(),
  skip: z.number().describe("The number of items to skip").optional(),
  emails: z.array(z.string()).describe("The email address or an array of email addresses to filter by").optional(),
  assignedOptionIds: z.array(z.string()).describe("Filter by assigned attribute option ids. ids must be separated by a comma.").optional(),
  attributeQueryOperator: z.enum(["OR", "AND", "NONE"]).describe("Query operator used to filter assigned options, AND by default.").optional(),
  teamIds: z.array(z.number()).describe("Filter by teamIds. Team ids must be separated by a comma.").optional(),
};

export async function getOrgUsers(params: {
  orgId: number;
  take?: number;
  skip?: number;
  emails?: string[];
  assignedOptionIds?: string[];
  attributeQueryOperator?: "OR" | "AND" | "NONE";
  teamIds?: number[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.emails !== undefined) qp.emails = params.emails.join(",");
    if (params.assignedOptionIds !== undefined) qp.assignedOptionIds = params.assignedOptionIds.join(",");
    if (params.attributeQueryOperator !== undefined) qp.attributeQueryOperator = params.attributeQueryOperator;
    if (params.teamIds !== undefined) qp.teamIds = params.teamIds.join(",");
    const data = await calApi(`organizations/${params.orgId}/users`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_users", err);
  }
}

export const createOrgUserSchema = {
  orgId: z.number().int().describe("orgId"),
  email: z.string().describe("User email address"),
  username: z.string().describe("Username").optional(),
  weekday: z.string().describe("Preferred weekday").optional(),
  brandColor: z.string().describe("Brand color in HEX format").optional(),
  bio: z.string().describe("Bio").optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters, and values up to 500 characters.").optional(),
  darkBrandColor: z.string().describe("Dark brand color in HEX format").optional(),
  hideBranding: z.boolean().describe("Hide branding").optional(),
  timeZone: z.string().describe("Time zone").optional(),
  theme: z.string().describe("Theme").optional(),
  appTheme: z.string().describe("Application theme").optional(),
  timeFormat: z.number().describe("Time format").optional(),
  defaultScheduleId: z.number().describe("Default schedule ID").optional(),
  locale: z.string().describe("Locale").optional(),
  avatarUrl: z.string().describe("Avatar URL").optional(),
  organizationRole: z.enum(["MEMBER", "ADMIN", "OWNER"]).optional(),
  autoAccept: z.boolean().optional(),
};

export async function createOrgUser(params: {
  orgId: number;
  email: string;
  username?: string;
  weekday?: string;
  brandColor?: string;
  bio?: string;
  metadata?: Record<string, unknown>;
  darkBrandColor?: string;
  hideBranding?: boolean;
  timeZone?: string;
  theme?: string;
  appTheme?: string;
  timeFormat?: number;
  defaultScheduleId?: number;
  locale?: string;
  avatarUrl?: string;
  organizationRole?: "MEMBER" | "ADMIN" | "OWNER";
  autoAccept?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.email = params.email;
    if (params.username !== undefined) body.username = params.username;
    if (params.weekday !== undefined) body.weekday = params.weekday;
    if (params.brandColor !== undefined) body.brandColor = params.brandColor;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.darkBrandColor !== undefined) body.darkBrandColor = params.darkBrandColor;
    if (params.hideBranding !== undefined) body.hideBranding = params.hideBranding;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.theme !== undefined) body.theme = params.theme;
    if (params.appTheme !== undefined) body.appTheme = params.appTheme;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.defaultScheduleId !== undefined) body.defaultScheduleId = params.defaultScheduleId;
    if (params.locale !== undefined) body.locale = params.locale;
    if (params.avatarUrl !== undefined) body.avatarUrl = params.avatarUrl;
    if (params.organizationRole !== undefined) body.organizationRole = params.organizationRole;
    if (params.autoAccept !== undefined) body.autoAccept = params.autoAccept;
    const data = await calApi(`organizations/${params.orgId}/users`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_user", err);
  }
}

export const updateOrgUserSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
};

export async function updateOrgUser(params: {
  orgId: number;
  userId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}`, { method: "PATCH", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("update_org_user", err);
  }
}

export const deleteOrgUserSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
};

export async function deleteOrgUser(params: {
  orgId: number;
  userId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_user", err);
  }
}
