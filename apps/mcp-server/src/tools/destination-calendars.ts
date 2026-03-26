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

export const updateDestinationCalendarsSchema = {
  integration: z.enum(["apple_calendar", "google_calendar", "office365_calendar"]).describe("The calendar service you want to integrate, as returned by the /calendars endpoint"),
  externalId: z.string().describe("Unique identifier used to represent the specific calendar, as returned by the /calendars endpoint"),
  delegationCredentialId: z.string().optional(),
};

export async function updateDestinationCalendars(params: {
  integration: "apple_calendar" | "google_calendar" | "office365_calendar";
  externalId: string;
  delegationCredentialId?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.integration = params.integration;
    body.externalId = params.externalId;
    if (params.delegationCredentialId !== undefined) body.delegationCredentialId = params.delegationCredentialId;
    const data = await calApi("destination-calendars", { method: "PUT", body });
    return ok(data);
  } catch (err) {
    return handleError("update_destination_calendars", err);
  }
}
