import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgTeamsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  take: z.number().optional().describe("Max results to return (default 250)"),
  skip: z.number().optional().describe("Results to skip (offset)"),
};

export async function getOrgTeams(params: { orgId: number; take?: number; skip?: number }) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/me`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_teams", err);
  }
}
