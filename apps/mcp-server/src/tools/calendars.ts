import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

const calendarToLoadSchema = z.object({
  credentialId: z.number().describe("The credential ID of the calendar integration"),
  externalId: z.string().describe("The external calendar ID (e.g. email address for Google Calendar)"),
});

export const getBusyTimesSchema = {
  dateFrom: z.string().describe("Start date for the query (e.g. '2024-08-13'). Required."),
  dateTo: z.string().describe("End date for the query (e.g. '2024-08-14'). Required."),
  calendarsToLoad: z
    .array(calendarToLoadSchema)
    .describe("Array of calendars to check. Each object needs credentialId and externalId. Required."),
  timeZone: z.string().optional().describe("IANA time zone for the query (e.g. 'America/New_York'). Defaults to UTC."),
};

export async function getBusyTimes(params: {
  dateFrom: string;
  dateTo: string;
  calendarsToLoad: { credentialId: number; externalId: string }[];
  timeZone?: string;
}) {
  try {
    const qp: Record<string, string | undefined> = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    };
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    params.calendarsToLoad.forEach((cal, i) => {
      qp[`calendarsToLoad[${i}][credentialId]`] = String(cal.credentialId);
      qp[`calendarsToLoad[${i}][externalId]`] = cal.externalId;
    });
    const data = await calApi("calendars/busy-times", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_busy_times", err);
  }
}
