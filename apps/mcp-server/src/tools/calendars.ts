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

export const getBusyTimesSchema = {
  dateFrom: z
    .string()
    .optional()
    .describe("Start date in ISO 8601 format (e.g. 2024-08-13T00:00:00Z)"),
  dateTo: z.string().optional().describe("End date in ISO 8601 format (e.g. 2024-08-14T00:00:00Z)"),
};

export async function getBusyTimes(params: { dateFrom?: string; dateTo?: string }) {
  try {
    const data = await calApi("calendars/busy-times", {
      params: { dateFrom: params.dateFrom, dateTo: params.dateTo },
    });
    return ok(data);
  } catch (err) {
    return handleError("get_busy_times", err);
  }
}
