import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getConnectedCalendarsSchema = {};

export async function getConnectedCalendars() {
  try {
    const data = await calApi("calendars");
    return ok(data);
  } catch (err) {
    return handleError("get_connected_calendars", err);
  }
}

export const getBusyTimesSchema = {
  dateFrom: z.string().describe("Start date for the query (e.g. '2024-08-13'). Required."),
  dateTo: z.string().describe("End date for the query (e.g. '2024-08-14'). Required."),
  credentialId: z.number().describe("The credential ID of the calendar integration. Use get_connected_calendars to obtain this — never guess."),
  externalId: z.string().describe("The external calendar ID (e.g. the email address for Google Calendar). Use get_connected_calendars to obtain this — never guess."),
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
    // The Cal.com v2 busy-times endpoint requires calendars in a nested array format:
    // calendarsToLoad[0][credentialId]=...&calendarsToLoad[0][externalId]=...
    const qp: Record<string, string | number | undefined> = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      "calendarsToLoad[0][credentialId]": params.credentialId,
      "calendarsToLoad[0][externalId]": params.externalId,
    };
    if (params.loggedInUsersTz !== undefined) qp.loggedInUsersTz = params.loggedInUsersTz;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    const data = await calApi("calendars/busy-times", { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_busy_times", err);
  }
}
