import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

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
