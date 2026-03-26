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

export const getCalendarsSchema = {};

export async function getCalendars() {
  try {
    const data = await calApi("calendars");
    return ok(data);
  } catch (err) {
    return handleError("get_calendars", err);
  }
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

// ── New tools (generated) ──

export const getCalendarConnectionsSchema = {};

export async function getCalendarConnections() {
  try {
    const data = await calApi("calendars/connections");
    return ok(data);
  } catch (err) {
    return handleError("get_calendar_connections", err);
  }
}

export const getConnectionEventsSchema = {
  connectionId: z.string().describe("connectionId"),
  from: z.string().describe("Start of the date range (ISO 8601 date or date-time)"),
  to: z.string().describe("End of the date range (ISO 8601 date or date-time)"),
  timeZone: z.string().describe("IANA time zone for the request (e.g. America/New_York)").optional(),
  calendarId: z.string().describe("Calendar ID. Use 'primary' for the user's primary calendar, or the external ID of a connected calendar.").optional(),
};

export async function getConnectionEvents(params: {
  connectionId: string;
  from: string;
  to: string;
  timeZone?: string;
  calendarId?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.from = params.from;
    qp.to = params.to;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    if (params.calendarId !== undefined) qp.calendarId = params.calendarId;
    const data = await calApi(`calendars/connections/${params.connectionId}/events`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_connection_events", err);
  }
}

export const createConnectionEventSchema = {
  connectionId: z.string().describe("connectionId"),
  calendarId: z.string().optional(),
  title: z.string().describe("Title of the calendar event"),
  start: z.object({
    time: z.string().describe("Start or end time in ISO 8601 format"),
    timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
  }),
  end: z.object({
    time: z.string().describe("Start or end time in ISO 8601 format"),
    timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
  }),
  description: z.string().describe("Description of the event").optional(),
  attendees: z.array(z.object({
    email: z.string().describe("Email address of the attendee"),
    name: z.string().optional().describe("Display name of the attendee"),
  })),
};

export async function createConnectionEvent(params: {
  connectionId: string;
  calendarId?: string;
  title: string;
  start: { time: string; timeZone: string };
  end: { time: string; timeZone: string };
  description?: string;
  attendees?: { email: string; name?: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.title = params.title;
    body.start = params.start;
    body.end = params.end;
    if (params.description !== undefined) body.description = params.description;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    const data = await calApi(`calendars/connections/${params.connectionId}/events`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_connection_event", err);
  }
}

export const getConnectionEventSchema = {
  connectionId: z.string().describe("connectionId"),
  eventId: z.string().describe("eventId"),
  calendarId: z.string().optional(),
};

export async function getConnectionEvent(params: {
  connectionId: string;
  eventId: string;
  calendarId?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.calendarId !== undefined) qp.calendarId = params.calendarId;
    const data = await calApi(`calendars/connections/${params.connectionId}/events/${params.eventId}`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_connection_event", err);
  }
}

export const updateConnectionEventSchema = {
  connectionId: z.string().describe("connectionId"),
  eventId: z.string().describe("eventId"),
  calendarId: z.string().optional(),
  start: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("Start date and time of the calendar event with timezone information"),
  end: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("End date and time of the calendar event with timezone information"),
  title: z.string().describe("Title of the calendar event").optional(),
  description: z.string().describe("Detailed description of the calendar event").optional(),
  attendees: z.array(z.object({
    email: z.string().optional().describe("Email address of the attendee"),
    name: z.string().optional().describe("Display name of the attendee"),
    responseStatus: z.enum(["accepted", "pending", "declined", "needsAction"]).optional().describe("Response status of the attendee"),
    self: z.boolean().optional().describe("Indicates if this attendee is the current user"),
    optional: z.boolean().optional().describe("Indicates if this attendee's attendance is optional"),
    host: z.boolean().optional().describe("Indicates if this attendee is the host"),
  })),
  status: z.enum(["accepted", "pending", "declined", "cancelled"]).optional(),
};

export async function updateConnectionEvent(params: {
  connectionId: string;
  eventId: string;
  calendarId?: string;
  start?: { time?: string; timeZone?: string };
  end?: { time?: string; timeZone?: string };
  title?: string;
  description?: string;
  attendees?: { email?: string; name?: string; responseStatus?: "accepted" | "pending" | "declined" | "needsAction"; self?: boolean; optional?: boolean; host?: boolean }[];
  status?: "accepted" | "pending" | "declined" | "cancelled";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.start !== undefined) body.start = params.start;
    if (params.end !== undefined) body.end = params.end;
    if (params.title !== undefined) body.title = params.title;
    if (params.description !== undefined) body.description = params.description;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    if (params.status !== undefined) body.status = params.status;
    const data = await calApi(`calendars/connections/${params.connectionId}/events/${params.eventId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_connection_event", err);
  }
}

export const deleteConnectionEventSchema = {
  connectionId: z.string().describe("connectionId"),
  eventId: z.string().describe("eventId"),
  calendarId: z.string().optional(),
};

export async function deleteConnectionEvent(params: {
  connectionId: string;
  eventId: string;
  calendarId?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.calendarId !== undefined) qp.calendarId = params.calendarId;
    const data = await calApi(`calendars/connections/${params.connectionId}/events/${params.eventId}`, { method: "DELETE", params: qp });
    return ok(data);
  } catch (err) {
    return handleError("delete_connection_event", err);
  }
}

export const getConnectionFreebusySchema = {
  connectionId: z.string().describe("connectionId"),
  from: z.string().describe("Start of the date range (ISO 8601 date or date-time)"),
  to: z.string().describe("End of the date range (ISO 8601 date or date-time)"),
  timeZone: z.string().describe("IANA time zone (e.g. America/New_York)").optional(),
};

export async function getConnectionFreebusy(params: {
  connectionId: string;
  from: string;
  to: string;
  timeZone?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.from = params.from;
    qp.to = params.to;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    const data = await calApi(`calendars/connections/${params.connectionId}/freebusy`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_connection_freebusy", err);
  }
}

export const getCalendarEventByUidSchema = {
  calendar: z.string().describe("calendar"),
  eventUid: z.string().describe("eventUid"),
};

export async function getCalendarEventByUid(params: {
  calendar: string;
  eventUid: string;
}) {
  try {
    const data = await calApi(`calendars/${params.calendar}/events/${params.eventUid}`);
    return ok(data);
  } catch (err) {
    return handleError("get_calendar_event_by_uid", err);
  }
}

export const updateCalendarEventByUidSchema = {
  calendar: z.string().describe("calendar"),
  eventUid: z.string().describe("eventUid"),
  start: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("Start date and time of the calendar event with timezone information"),
  end: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("End date and time of the calendar event with timezone information"),
  title: z.string().describe("Title of the calendar event").optional(),
  description: z.string().describe("Detailed description of the calendar event").optional(),
  attendees: z.array(z.object({
    email: z.string().optional().describe("Email address of the attendee"),
    name: z.string().optional().describe("Display name of the attendee"),
    responseStatus: z.enum(["accepted", "pending", "declined", "needsAction"]).optional().describe("Response status of the attendee"),
    self: z.boolean().optional().describe("Indicates if this attendee is the current user"),
    optional: z.boolean().optional().describe("Indicates if this attendee's attendance is optional"),
    host: z.boolean().optional().describe("Indicates if this attendee is the host"),
  })),
  status: z.enum(["accepted", "pending", "declined", "cancelled"]).optional(),
};

export async function updateCalendarEventByUid(params: {
  calendar: string;
  eventUid: string;
  start?: { time?: string; timeZone?: string };
  end?: { time?: string; timeZone?: string };
  title?: string;
  description?: string;
  attendees?: { email?: string; name?: string; responseStatus?: "accepted" | "pending" | "declined" | "needsAction"; self?: boolean; optional?: boolean; host?: boolean }[];
  status?: "accepted" | "pending" | "declined" | "cancelled";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.start !== undefined) body.start = params.start;
    if (params.end !== undefined) body.end = params.end;
    if (params.title !== undefined) body.title = params.title;
    if (params.description !== undefined) body.description = params.description;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    if (params.status !== undefined) body.status = params.status;
    const data = await calApi(`calendars/${params.calendar}/events/${params.eventUid}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_calendar_event_by_uid", err);
  }
}

export const deleteCalendarEventSchema = {
  calendar: z.string().describe("calendar"),
  eventUid: z.string().describe("eventUid"),
};

export async function deleteCalendarEvent(params: {
  calendar: string;
  eventUid: string;
}) {
  try {
    const data = await calApi(`calendars/${params.calendar}/events/${params.eventUid}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_calendar_event", err);
  }
}

export const getCalendarEventSchema = {
  calendar: z.string().describe("calendar"),
  eventUid: z.string().describe("eventUid"),
};

export async function getCalendarEvent(params: {
  calendar: string;
  eventUid: string;
}) {
  try {
    const data = await calApi(`calendars/${params.calendar}/event/${params.eventUid}`);
    return ok(data);
  } catch (err) {
    return handleError("get_calendar_event", err);
  }
}

export const updateCalendarEventSchema = {
  calendar: z.string().describe("calendar"),
  eventUid: z.string().describe("eventUid"),
  start: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("Start date and time of the calendar event with timezone information"),
  end: z.object({
    time: z.string().optional(),
    timeZone: z.string().optional(),
  }).describe("End date and time of the calendar event with timezone information"),
  title: z.string().describe("Title of the calendar event").optional(),
  description: z.string().describe("Detailed description of the calendar event").optional(),
  attendees: z.array(z.object({
    email: z.string().optional().describe("Email address of the attendee"),
    name: z.string().optional().describe("Display name of the attendee"),
    responseStatus: z.enum(["accepted", "pending", "declined", "needsAction"]).optional().describe("Response status of the attendee"),
    self: z.boolean().optional().describe("Indicates if this attendee is the current user"),
    optional: z.boolean().optional().describe("Indicates if this attendee's attendance is optional"),
    host: z.boolean().optional().describe("Indicates if this attendee is the host"),
  })),
  status: z.enum(["accepted", "pending", "declined", "cancelled"]).optional(),
};

export async function updateCalendarEvent(params: {
  calendar: string;
  eventUid: string;
  start?: { time?: string; timeZone?: string };
  end?: { time?: string; timeZone?: string };
  title?: string;
  description?: string;
  attendees?: { email?: string; name?: string; responseStatus?: "accepted" | "pending" | "declined" | "needsAction"; self?: boolean; optional?: boolean; host?: boolean }[];
  status?: "accepted" | "pending" | "declined" | "cancelled";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.start !== undefined) body.start = params.start;
    if (params.end !== undefined) body.end = params.end;
    if (params.title !== undefined) body.title = params.title;
    if (params.description !== undefined) body.description = params.description;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    if (params.status !== undefined) body.status = params.status;
    const data = await calApi(`calendars/${params.calendar}/event/${params.eventUid}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_calendar_event", err);
  }
}

export const listCalendarEventsSchema = {
  calendar: z.string().describe("calendar"),
  from: z.string().describe("Start of the date range (ISO 8601 date or date-time)"),
  to: z.string().describe("End of the date range (ISO 8601 date or date-time)"),
  timeZone: z.string().describe("IANA time zone for the request (e.g. America/New_York)").optional(),
  calendarId: z.string().describe("Calendar ID. Use 'primary' for the user's primary calendar, or the external ID of a connected calendar.").optional(),
};

export async function listCalendarEvents(params: {
  calendar: string;
  from: string;
  to: string;
  timeZone?: string;
  calendarId?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.from = params.from;
    qp.to = params.to;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    if (params.calendarId !== undefined) qp.calendarId = params.calendarId;
    const data = await calApi(`calendars/${params.calendar}/events`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("list_calendar_events", err);
  }
}

export const createCalendarEventSchema = {
  calendar: z.string().describe("calendar"),
  title: z.string().describe("Title of the calendar event"),
  start: z.object({
    time: z.string().describe("Start or end time in ISO 8601 format"),
    timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
  }),
  end: z.object({
    time: z.string().describe("Start or end time in ISO 8601 format"),
    timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
  }),
  description: z.string().describe("Description of the event").optional(),
  attendees: z.array(z.object({
    email: z.string().describe("Email address of the attendee"),
    name: z.string().optional().describe("Display name of the attendee"),
  })),
};

export async function createCalendarEvent(params: {
  calendar: string;
  title: string;
  start: { time: string; timeZone: string };
  end: { time: string; timeZone: string };
  description?: string;
  attendees?: { email: string; name?: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.title = params.title;
    body.start = params.start;
    body.end = params.end;
    if (params.description !== undefined) body.description = params.description;
    if (params.attendees !== undefined) body.attendees = params.attendees;
    const data = await calApi(`calendars/${params.calendar}/events`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_calendar_event", err);
  }
}

export const getCalendarFreebusySchema = {
  calendar: z.string().describe("calendar"),
  from: z.string().describe("Start of the date range (ISO 8601 date or date-time)"),
  to: z.string().describe("End of the date range (ISO 8601 date or date-time)"),
  timeZone: z.string().describe("IANA time zone (e.g. America/New_York)").optional(),
};

export async function getCalendarFreebusy(params: {
  calendar: string;
  from: string;
  to: string;
  timeZone?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.from = params.from;
    qp.to = params.to;
    if (params.timeZone !== undefined) qp.timeZone = params.timeZone;
    const data = await calApi(`calendars/${params.calendar}/freebusy`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_calendar_freebusy", err);
  }
}

export const saveIcsFeedSchema = {
  urls: z.array(z.string()).describe("An array of ICS URLs"),
  readOnly: z.boolean().describe("Whether to allowing writing to the calendar or not").optional(),
};

export async function saveIcsFeed(params: {
  urls: string[];
  readOnly?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.urls = params.urls;
    if (params.readOnly !== undefined) body.readOnly = params.readOnly;
    const data = await calApi("calendars/ics-feed/save", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("save_ics_feed", err);
  }
}

export const checkIcsFeedSchema = {};

export async function checkIcsFeed() {
  try {
    const data = await calApi("calendars/ics-feed/check");
    return ok(data);
  } catch (err) {
    return handleError("check_ics_feed", err);
  }
}

export const getCalendarConnectUrlSchema = {
  calendar: z.string().describe("calendar"),
  isDryRun: z.boolean(),
  redir: z.string().describe("Redirect URL after successful calendar authorization.").optional(),
};

export async function getCalendarConnectUrl(params: {
  calendar: string;
  isDryRun: boolean;
  redir?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    qp.isDryRun = params.isDryRun;
    if (params.redir !== undefined) qp.redir = params.redir;
    const data = await calApi(`calendars/${params.calendar}/connect`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_calendar_connect_url", err);
  }
}

export const saveCalendarCredentialsSchema = {
  calendar: z.string().describe("calendar"),
  username: z.string(),
  password: z.string(),
};

export async function saveCalendarCredentials(params: {
  calendar: string;
  username: string;
  password: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.username = params.username;
    body.password = params.password;
    const data = await calApi(`calendars/${params.calendar}/credentials`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("save_calendar_credentials", err);
  }
}

export const checkCalendarConnectionSchema = {
  calendar: z.string().describe("calendar"),
};

export async function checkCalendarConnection(params: {
  calendar: string;
}) {
  try {
    const data = await calApi(`calendars/${params.calendar}/check`);
    return ok(data);
  } catch (err) {
    return handleError("check_calendar_connection", err);
  }
}

export const disconnectCalendarSchema = {
  calendar: z.string().describe("calendar"),
  id: z.number().int().describe("Credential ID of the calendar to delete, as returned by the /calendars endpoint"),
};

export async function disconnectCalendar(params: {
  calendar: string;
  id: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.id = params.id;
    const data = await calApi(`calendars/${params.calendar}/disconnect`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("disconnect_calendar", err);
  }
}
