import type { Command } from "commander";
import { apiRequest } from "../../shared/api";
import { getApiUrl, getAuthToken } from "../../shared/config";
import { withErrorHandling } from "../../shared/errors";
import {
  renderBusyTimes,
  renderConnections,
  renderEvent,
  renderEventCreated,
  renderEventDeleted,
  renderEventList,
  renderEventUpdated,
} from "./output";
import type {
  BusyTimesResponse,
  CalendarEvent,
  ConnectionsResponse,
  EventListResponse,
  EventResponse,
} from "./types";

function registerConnectionsCommand(unifiedCalCmd: Command): void {
  unifiedCalCmd
    .command("connections")
    .description("List calendar connections for the authenticated user")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      await withErrorHandling(async () => {
        const response = await apiRequest<ConnectionsResponse["data"]>(
          "/v2/calendars/connections"
        );
        renderConnections(response.data?.connections, options);
      });
    });
}

function registerEventsCommands(unifiedCalCmd: Command): void {
  const eventsCmd = unifiedCalCmd.command("events").description("Manage calendar events via unified API");

  eventsCmd
    .command("list")
    .description("List events for a calendar connection")
    .requiredOption("--connection-id <id>", "Calendar connection ID (from 'unified-cal connections')")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD or ISO 8601)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD or ISO 8601)")
    .option("--calendar-id <id>", "Calendar ID within the connection (default: primary)")
    .option("--timezone <tz>", "Timezone (e.g. America/New_York)")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        from: string;
        to: string;
        calendarId?: string;
        timezone?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const query: Record<string, string | undefined> = {
            from: options.from,
            to: options.to,
            calendarId: options.calendarId,
            timeZone: options.timezone,
          };

          const response = await apiRequest<EventListResponse["data"]>(
            `/v2/calendars/connections/${options.connectionId}/events`,
            { query }
          );
          renderEventList(response.data as CalendarEvent[] | undefined, options);
        });
      }
    );

  eventsCmd
    .command("get")
    .description("Get a single event by ID")
    .requiredOption("--connection-id <id>", "Calendar connection ID")
    .requiredOption("--event-id <id>", "Event ID")
    .option("--calendar-id <id>", "Calendar ID within the connection (default: primary)")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        eventId: string;
        calendarId?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const query: Record<string, string | undefined> = {
            calendarId: options.calendarId,
          };

          const response = await apiRequest<EventResponse["data"]>(
            `/v2/calendars/connections/${options.connectionId}/events/${options.eventId}`,
            { query }
          );
          renderEvent(response.data as CalendarEvent | undefined, options);
        });
      }
    );

  eventsCmd
    .command("create")
    .description("Create a new event on a calendar connection")
    .requiredOption("--connection-id <id>", "Calendar connection ID")
    .requiredOption("--title <title>", "Event title/summary")
    .requiredOption("--start <datetime>", "Start time (ISO 8601, e.g. 2026-03-20T14:00:00)")
    .requiredOption("--end <datetime>", "End time (ISO 8601, e.g. 2026-03-20T15:00:00)")
    .option("--description <text>", "Event description")
    .option("--location <location>", "Event location")
    .option("--timezone <tz>", "Timezone (e.g. America/New_York)")
    .option("--attendees <emails>", "Comma-separated attendee emails")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        title: string;
        start: string;
        end: string;
        description?: string;
        location?: string;
        timezone?: string;
        attendees?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const body: Record<string, unknown> = {
            summary: options.title,
            start: options.start,
            end: options.end,
          };

          if (options.description) {
            body.description = options.description;
          }
          if (options.location) {
            body.location = options.location;
          }
          if (options.timezone) {
            body.timeZone = options.timezone;
          }
          if (options.attendees) {
            body.attendees = options.attendees.split(",").map((email) => ({
              email: email.trim(),
            }));
          }

          const response = await apiRequest<EventResponse["data"]>(
            `/v2/calendars/connections/${options.connectionId}/events`,
            { method: "POST", body }
          );
          renderEventCreated(response.data as CalendarEvent | undefined, options);
        });
      }
    );

  eventsCmd
    .command("update")
    .description("Update an existing event")
    .requiredOption("--connection-id <id>", "Calendar connection ID")
    .requiredOption("--event-id <id>", "Event ID to update")
    .option("--title <title>", "New event title/summary")
    .option("--start <datetime>", "New start time (ISO 8601)")
    .option("--end <datetime>", "New end time (ISO 8601)")
    .option("--description <text>", "New event description")
    .option("--location <location>", "New event location")
    .option("--timezone <tz>", "Timezone")
    .option("--calendar-id <id>", "Calendar ID within the connection (default: primary)")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        eventId: string;
        title?: string;
        start?: string;
        end?: string;
        description?: string;
        location?: string;
        timezone?: string;
        calendarId?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const body: Record<string, unknown> = {};
          if (options.title) {
            body.summary = options.title;
          }
          if (options.start) {
            body.start = options.start;
          }
          if (options.end) {
            body.end = options.end;
          }
          if (options.description) {
            body.description = options.description;
          }
          if (options.location) {
            body.location = options.location;
          }
          if (options.timezone) {
            body.timeZone = options.timezone;
          }

          const query: Record<string, string | undefined> = {
            calendarId: options.calendarId,
          };

          const response = await apiRequest<EventResponse["data"]>(
            `/v2/calendars/connections/${options.connectionId}/events/${options.eventId}`,
            { method: "PATCH", body, query }
          );
          renderEventUpdated(response.data as CalendarEvent | undefined, options);
        });
      }
    );

  eventsCmd
    .command("delete")
    .description("Delete/cancel an event")
    .requiredOption("--connection-id <id>", "Calendar connection ID")
    .requiredOption("--event-id <id>", "Event ID to delete")
    .option("--calendar-id <id>", "Calendar ID within the connection (default: primary)")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        eventId: string;
        calendarId?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const apiUrl = getApiUrl();
          const token = await getAuthToken();

          let url = `${apiUrl}/v2/calendars/connections/${options.connectionId}/events/${options.eventId}`;
          if (options.calendarId) {
            url += `?calendarId=${encodeURIComponent(options.calendarId)}`;
          }

          const response = await fetch(url, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(
              `API Error (${response.status}): ${errorBody || response.statusText}`
            );
          }

          renderEventDeleted(options);
        });
      }
    );
}

function registerFreeBusyCommand(unifiedCalCmd: Command): void {
  unifiedCalCmd
    .command("freebusy")
    .description("Get free/busy times for a calendar connection")
    .requiredOption("--connection-id <id>", "Calendar connection ID")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD or ISO 8601)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD or ISO 8601)")
    .option("--timezone <tz>", "Timezone (e.g. America/New_York)")
    .option("--json", "Output as JSON")
    .action(
      async (options: {
        connectionId: string;
        from: string;
        to: string;
        timezone?: string;
        json?: boolean;
      }) => {
        await withErrorHandling(async () => {
          const query: Record<string, string | undefined> = {
            from: options.from,
            to: options.to,
            timeZone: options.timezone,
          };

          const response = await apiRequest<BusyTimesResponse["data"]>(
            `/v2/calendars/connections/${options.connectionId}/freebusy`,
            { query }
          );
          renderBusyTimes(response.data as BusyTimesResponse["data"] | undefined, options);
        });
      }
    );
}

export function registerUnifiedCalCommand(program: Command): void {
  const unifiedCalCmd = program
    .command("unified-cal")
    .description("Unified calendar API — CRUD operations on connected calendar events");

  registerConnectionsCommand(unifiedCalCmd);
  registerEventsCommands(unifiedCalCmd);
  registerFreeBusyCommand(unifiedCalCmd);
}
