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

export const getOrgTeamSchedulesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
  eventTypeId: z.number().describe("Filter schedules by event type ID").optional(),
};

export async function getOrgTeamSchedules(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
  eventTypeId?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/schedules`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_schedules", err);
  }
}

export const getOrgTeamUserSchedulesSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  userId: z.number().int().describe("userId"),
  eventTypeId: z.number().describe("Filter schedules by event type ID").optional(),
};

export async function getOrgTeamUserSchedules(params: {
  orgId: number;
  teamId: number;
  userId: number;
  eventTypeId?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.eventTypeId !== undefined) qp.eventTypeId = params.eventTypeId;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/users/${params.userId}/schedules`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_user_schedules", err);
  }
}
