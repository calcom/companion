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

export const connectOrgTeamConferencingAppSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  app: z.string().describe("app"),
};

export async function connectOrgTeamConferencingApp(params: {
  orgId: number;
  teamId: number;
  app: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing/${params.app}/connect`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("connect_org_team_conferencing_app", err);
  }
}

export const getOrgTeamConferencingAuthUrlSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.string().describe("teamId"),
  app: z.string().describe("app"),
  returnTo: z.string(),
  onErrorReturnTo: z.string(),
};

export async function getOrgTeamConferencingAuthUrl(params: {
  orgId: number;
  teamId: string;
  app: string;
  returnTo: string;
  onErrorReturnTo: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.returnTo = params.returnTo;
    qp.onErrorReturnTo = params.onErrorReturnTo;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing/${params.app}/oauth/auth-url`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_conferencing_auth_url", err);
  }
}

export const getOrgTeamConferencingAppsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
};

export async function getOrgTeamConferencingApps(params: {
  orgId: number;
  teamId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_conferencing_apps", err);
  }
}

export const setOrgTeamDefaultConferencingSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  app: z.string().describe("app"),
};

export async function setOrgTeamDefaultConferencing(params: {
  orgId: number;
  teamId: number;
  app: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing/${params.app}/default`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("set_org_team_default_conferencing", err);
  }
}

export const getOrgTeamDefaultConferencingSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
};

export async function getOrgTeamDefaultConferencing(params: {
  orgId: number;
  teamId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing/default`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_default_conferencing", err);
  }
}

export const disconnectOrgTeamConferencingAppSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  app: z.string().describe("app"),
};

export async function disconnectOrgTeamConferencingApp(params: {
  orgId: number;
  teamId: number;
  app: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/conferencing/${params.app}/disconnect`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("disconnect_org_team_conferencing_app", err);
  }
}
