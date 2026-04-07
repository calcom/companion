import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getBusyTimesSchema = {
  dateFrom: z.string().describe("Start date for the query (e.g. '2024-08-13'). Required."),
  dateTo: z.string().describe("End date for the query (e.g. '2024-08-14'). Required."),
  credentialId: z.number().describe("The credential ID of the calendar integration. Obtain from the API (e.g. via get_conferencing_apps or calendar endpoints) — never guess."),
  externalId: z.string().describe("The external calendar ID (e.g. the email address for Google Calendar). Obtain from the API — never guess."),
  loggedInUsersTz: z.string().optional().describe("IANA time zone of the logged-in user (e.g. 'America/New_York'). Used to interpret date boundaries."),
  timeZone: z.string().optional().describe("IANA time zone for the query (e.g. 'America/New_York'). Defaults to UTC."),
};

export async function getBusyTimes(params: {
  dateFrom: string;
  dateTo: string;
  credentialId: number;
  externalId: string;
  loggedInUsersTz?: string;
  timeZone?: string;
}) {
  try {
    const qp: Record<string, string | number | undefined> = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      credentialId: params.credentialId,
      externalId: params.externalId,
    };
    if (params.loggedInUsersTz !== undefined) qp.loggedInUsersTz = params.loggedInUsersTz;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    const data = await calApi("calendars/busy-times", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_busy_times", err);
  }
}
