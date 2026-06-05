import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgTeamsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  take: z.number().int().min(1).max(250).optional().describe("Max results to return (1-250)"),
  skip: z.number().int().min(0).optional().describe("Results to skip (offset, min 0)"),
};

export async function getOrgTeams(params: { orgId: number; take?: number; skip?: number }) {
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

export const getMyTeamsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  take: z.number().int().min(1).max(250).optional().describe("Max results to return (1-250)"),
  skip: z.number().int().min(0).optional().describe("Results to skip (offset, min 0)"),
};

export async function getMyTeams(params: { orgId: number; take?: number; skip?: number }) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/me`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_my_teams", err);
  }
}
