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

export const getAvailabilitySchema = {
  startTime: z
    .string()
    .describe("Start of the time range in ISO 8601 format (e.g. 2024-08-13T00:00:00Z)"),
  endTime: z
    .string()
    .describe("End of the time range in ISO 8601 format (e.g. 2024-08-14T00:00:00Z)"),
  eventTypeId: z.number().int().optional().describe("Filter by event type ID"),
  eventTypeSlug: z.string().optional().describe("Filter by event type slug"),
  usernameList: z.array(z.string()).optional().describe("Filter by usernames"),
  timeZone: z.string().describe("IANA time zone for the results (e.g. America/New_York)"),
};

export async function getAvailability(params: {
  startTime: string;
  endTime: string;
  eventTypeId?: number;
  eventTypeSlug?: string;
  usernameList?: string[];
  timeZone: string;
}) {
  try {
    const queryParams: Record<string, string | number | string[] | undefined> = {
      startTime: params.startTime,
      endTime: params.endTime,
      timeZone: params.timeZone,
    };
    if (params.eventTypeId !== undefined) queryParams.eventTypeId = params.eventTypeId;
    if (params.eventTypeSlug) queryParams.eventTypeSlug = params.eventTypeSlug;
    if (params.usernameList && params.usernameList.length > 0) {
      queryParams.usernameList = params.usernameList;
    }
    const data = await calApi("slots/available", { params: queryParams });
    return ok(data);
  } catch (err) {
    return handleError("get_availability", err);
  }
}
