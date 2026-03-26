import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

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

export const addSelectedCalendarSchema = {
  integration: z.string(),
  externalId: z.string(),
  credentialId: z.number(),
  delegationCredentialId: z.string().optional(),
};

export async function addSelectedCalendar(params: {
  integration: string;
  externalId: string;
  credentialId: number;
  delegationCredentialId?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.integration = params.integration;
    body.externalId = params.externalId;
    body.credentialId = params.credentialId;
    if (params.delegationCredentialId !== undefined) body.delegationCredentialId = params.delegationCredentialId;
    const data = await calApi("selected-calendars", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("add_selected_calendar", err);
  }
}

export const removeSelectedCalendarSchema = {
  integration: z.string(),
  externalId: z.string(),
  credentialId: z.string(),
  delegationCredentialId: z.string().optional(),
};

export async function removeSelectedCalendar(params: {
  integration: string;
  externalId: string;
  credentialId: string;
  delegationCredentialId?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.integration = params.integration;
    qp.externalId = params.externalId;
    qp.credentialId = params.credentialId;
    if (params.delegationCredentialId !== undefined) qp.delegationCredentialId = params.delegationCredentialId;
    const data = await calApi("selected-calendars", { method: "DELETE", params: qp });
    return ok(data);
  } catch (err) {
    return handleError("remove_selected_calendar", err);
  }
}
