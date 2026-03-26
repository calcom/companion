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

export const getOrgTeamsSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeams(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_teams", err);
  }
}

export const createOrgTeamSchema = {
  orgId: z.number().int().describe("orgId"),
  name: z.string().describe("Name of the team"),
  slug: z.string().describe("Team slug in kebab-case - if not provided will be generated automatically based on name.").optional(),
  logoUrl: z.string().describe("URL of the teams logo image").optional(),
  calVideoLogo: z.string().optional(),
  appLogo: z.string().optional(),
  appIconLogo: z.string().optional(),
  bio: z.string().optional(),
  hideBranding: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  hideBookATeamMember: z.boolean().optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
  theme: z.string().optional(),
  brandColor: z.string().optional(),
  darkBrandColor: z.string().optional(),
  bannerUrl: z.string().describe("URL of the teams banner image which is shown on booker").optional(),
  timeFormat: z.number().optional(),
  timeZone: z.string().describe("Timezone is used to create teams's default schedule from Monday to Friday from 9AM to 5PM. It will default to Europe/London if not passed.").optional(),
  weekStart: z.string().optional(),
  autoAcceptCreator: z.boolean().describe("If you are a platform customer, don't pass 'false', because then team creator won't be able to create team event types.").optional(),
};

export async function createOrgTeam(params: {
  orgId: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  calVideoLogo?: string;
  appLogo?: string;
  appIconLogo?: string;
  bio?: string;
  hideBranding?: boolean;
  isPrivate?: boolean;
  hideBookATeamMember?: boolean;
  metadata?: Record<string, unknown>;
  theme?: string;
  brandColor?: string;
  darkBrandColor?: string;
  bannerUrl?: string;
  timeFormat?: number;
  timeZone?: string;
  weekStart?: string;
  autoAcceptCreator?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.logoUrl !== undefined) body.logoUrl = params.logoUrl;
    if (params.calVideoLogo !== undefined) body.calVideoLogo = params.calVideoLogo;
    if (params.appLogo !== undefined) body.appLogo = params.appLogo;
    if (params.appIconLogo !== undefined) body.appIconLogo = params.appIconLogo;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.hideBranding !== undefined) body.hideBranding = params.hideBranding;
    if (params.isPrivate !== undefined) body.isPrivate = params.isPrivate;
    if (params.hideBookATeamMember !== undefined) body.hideBookATeamMember = params.hideBookATeamMember;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.theme !== undefined) body.theme = params.theme;
    if (params.brandColor !== undefined) body.brandColor = params.brandColor;
    if (params.darkBrandColor !== undefined) body.darkBrandColor = params.darkBrandColor;
    if (params.bannerUrl !== undefined) body.bannerUrl = params.bannerUrl;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.weekStart !== undefined) body.weekStart = params.weekStart;
    if (params.autoAcceptCreator !== undefined) body.autoAcceptCreator = params.autoAcceptCreator;
    const data = await calApi(`organizations/${params.orgId}/teams`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team", err);
  }
}

export const getOrgTeamsMembershipSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamsMembership(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/me`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_teams_membership", err);
  }
}

export const getOrgTeamSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
};

export async function getOrgTeam(params: {
  orgId: number;
  teamId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team", err);
  }
}

export const deleteOrgTeamSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
};

export async function deleteOrgTeam(params: {
  orgId: number;
  teamId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team", err);
  }
}

export const updateOrgTeamSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  name: z.string().describe("Name of the team").optional(),
  slug: z.string().describe("Team slug").optional(),
  logoUrl: z.string().describe("URL of the teams logo image").optional(),
  calVideoLogo: z.string().optional(),
  appLogo: z.string().optional(),
  appIconLogo: z.string().optional(),
  bio: z.string().optional(),
  hideBranding: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  hideBookATeamMember: z.boolean().optional(),
  metadata: z.record(z.unknown()).describe("You can store any additional data you want here. Metadata must have at most 50 keys, each key up to 40 characters. Values can be strings (up to 500 characters), numbers, or booleans.").optional(),
  theme: z.string().optional(),
  brandColor: z.string().optional(),
  darkBrandColor: z.string().optional(),
  bannerUrl: z.string().describe("URL of the teams banner image which is shown on booker").optional(),
  timeFormat: z.number().optional(),
  timeZone: z.string().describe("Timezone is used to create teams's default schedule from Monday to Friday from 9AM to 5PM. It will default to Europe/London if not passed.").optional(),
  weekStart: z.string().optional(),
  bookingLimits: z.string().optional(),
  includeManagedEventsInLimits: z.boolean().optional(),
};

export async function updateOrgTeam(params: {
  orgId: number;
  teamId: number;
  name?: string;
  slug?: string;
  logoUrl?: string;
  calVideoLogo?: string;
  appLogo?: string;
  appIconLogo?: string;
  bio?: string;
  hideBranding?: boolean;
  isPrivate?: boolean;
  hideBookATeamMember?: boolean;
  metadata?: Record<string, unknown>;
  theme?: string;
  brandColor?: string;
  darkBrandColor?: string;
  bannerUrl?: string;
  timeFormat?: number;
  timeZone?: string;
  weekStart?: string;
  bookingLimits?: string;
  includeManagedEventsInLimits?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.logoUrl !== undefined) body.logoUrl = params.logoUrl;
    if (params.calVideoLogo !== undefined) body.calVideoLogo = params.calVideoLogo;
    if (params.appLogo !== undefined) body.appLogo = params.appLogo;
    if (params.appIconLogo !== undefined) body.appIconLogo = params.appIconLogo;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.hideBranding !== undefined) body.hideBranding = params.hideBranding;
    if (params.isPrivate !== undefined) body.isPrivate = params.isPrivate;
    if (params.hideBookATeamMember !== undefined) body.hideBookATeamMember = params.hideBookATeamMember;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    if (params.theme !== undefined) body.theme = params.theme;
    if (params.brandColor !== undefined) body.brandColor = params.brandColor;
    if (params.darkBrandColor !== undefined) body.darkBrandColor = params.darkBrandColor;
    if (params.bannerUrl !== undefined) body.bannerUrl = params.bannerUrl;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.weekStart !== undefined) body.weekStart = params.weekStart;
    if (params.bookingLimits !== undefined) body.bookingLimits = params.bookingLimits;
    if (params.includeManagedEventsInLimits !== undefined) body.includeManagedEventsInLimits = params.includeManagedEventsInLimits;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team", err);
  }
}

export const getOrgAllTeamEventTypesSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  sortCreatedAt: z.enum(["asc", "desc"]).describe("Sort event types by creation date. When not provided, no explicit ordering is applied.").optional(),
};

export async function getOrgAllTeamEventTypes(params: {
  orgId: number;
  take?: number;
  skip?: number;
  sortCreatedAt?: "asc" | "desc";
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.sortCreatedAt !== undefined) qp.sortCreatedAt = params.sortCreatedAt;
    const data = await calApi(`organizations/${params.orgId}/teams/event-types`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_all_team_event_types", err);
  }
}
