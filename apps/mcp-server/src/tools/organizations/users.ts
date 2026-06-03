import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

// ── Get Org Users ──

export const getOrgUsersSchema = {
	orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
	take: z.number().optional().describe("Max results to return"),
	skip: z.number().optional().describe("Results to skip (offset)"),
	emails: z.array(z.string()).optional().describe("Filter by email addresses"),
};

export async function getOrgUsers(params: {
	orgId: number;
	take?: number;
	skip?: number;
	emails?: string[];
}) {
	try {
		const qp: Record<string, string | number | boolean | string[] | undefined> = {};
		if (params.take !== undefined) qp.take = params.take;
		if (params.skip !== undefined) qp.skip = params.skip;
		if (params.emails !== undefined) qp.emails = params.emails;
		const data = await calApi(`organizations/${params.orgId}/users`, { params: qp });
		return ok(data);
	} catch (err) {
		return handleError("get_org_users", err);
	}
}

// ── Create Org User ──

export const createOrgUserSchema = {
	orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
	email: z.string().describe("Email address of the new user"),
	username: z.string().describe("Username for the new user"),
	name: z.string().optional().describe("Display name"),
	timeZone: z.string().optional().describe("IANA time zone (e.g. 'America/New_York')"),
	weekStart: z.string().optional().describe("Week start day (e.g. 'Monday')"),
	timeFormat: z.number().optional().describe("Time format (12 or 24)"),
	locale: z.string().optional().describe("Locale (e.g. 'en')"),
	avatarUrl: z.string().optional().describe("Avatar image URL"),
	organizationRole: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional().describe("Role in the organization"),
	autoAccept: z.boolean().optional().describe("Auto-accept the invitation"),
};

export async function createOrgUser(params: {
	orgId: number;
	email: string;
	username: string;
	name?: string;
	timeZone?: string;
	weekStart?: string;
	timeFormat?: number;
	locale?: string;
	avatarUrl?: string;
	organizationRole?: "MEMBER" | "OWNER" | "ADMIN";
	autoAccept?: boolean;
}) {
	try {
		const body: Record<string, unknown> = {};
		body.email = params.email;
		body.username = params.username;
		if (params.name !== undefined) body.name = params.name;
		if (params.timeZone !== undefined) body.timeZone = params.timeZone;
		if (params.weekStart !== undefined) body.weekStart = params.weekStart;
		if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
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

// ── Update Org User ──

export const updateOrgUserSchema = {
	orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
	userId: z.number().int().describe("User ID to update. Use get_org_users to find this — never guess."),
	name: z.string().optional().describe("Display name"),
	email: z.string().optional().describe("Email address"),
	username: z.string().optional().describe("Username"),
	timeZone: z.string().optional().describe("IANA time zone (e.g. 'America/New_York')"),
	weekStart: z.string().optional().describe("Week start day (e.g. 'Monday')"),
	timeFormat: z.number().optional().describe("Time format (12 or 24)"),
	locale: z.string().optional().describe("Locale (e.g. 'en')"),
	avatarUrl: z.string().optional().describe("Avatar image URL"),
	organizationRole: z.enum(["MEMBER", "OWNER", "ADMIN"]).optional().describe("New role in the organization"),
};

export async function updateOrgUser(params: {
	orgId: number;
	userId: number;
	name?: string;
	email?: string;
	username?: string;
	timeZone?: string;
	weekStart?: string;
	timeFormat?: number;
	locale?: string;
	avatarUrl?: string;
	organizationRole?: "MEMBER" | "OWNER" | "ADMIN";
}) {
	try {
		const body: Record<string, unknown> = {};
		if (params.name !== undefined) body.name = params.name;
		if (params.email !== undefined) body.email = params.email;
		if (params.username !== undefined) body.username = params.username;
		if (params.timeZone !== undefined) body.timeZone = params.timeZone;
		if (params.weekStart !== undefined) body.weekStart = params.weekStart;
		if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
		if (params.locale !== undefined) body.locale = params.locale;
		if (params.avatarUrl !== undefined) body.avatarUrl = params.avatarUrl;
		if (params.organizationRole !== undefined) body.organizationRole = params.organizationRole;
		const data = await calApi(`organizations/${params.orgId}/users/${params.userId}`, { method: "PATCH", body });
		return ok(data);
	} catch (err) {
		return handleError("update_org_user", err);
	}
}

// ── Delete Org User ──

export const deleteOrgUserSchema = {
	orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
	userId: z.number().int().describe("User ID to remove. Use get_org_users to find this — never guess."),
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
