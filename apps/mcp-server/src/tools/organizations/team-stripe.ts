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

export const getOrgTeamStripeConnectUrlSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.string().describe("teamId"),
  returnTo: z.string(),
  onErrorReturnTo: z.string(),
};

export async function getOrgTeamStripeConnectUrl(params: {
  orgId: number;
  teamId: string;
  returnTo: string;
  onErrorReturnTo: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.returnTo = params.returnTo;
    qp.onErrorReturnTo = params.onErrorReturnTo;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/stripe/connect`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_stripe_connect_url", err);
  }
}

export const checkOrgTeamStripeSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
};

export async function checkOrgTeamStripe(params: {
  orgId: number;
  teamId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/stripe/check`);
    return ok(data);
  } catch (err) {
    return handleError("check_org_team_stripe", err);
  }
}
