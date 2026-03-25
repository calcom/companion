#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthMode, initOAuthTokens } from "./auth.js";

import {
  getBookingsSchema,
  getBookings,
  getBookingSchema,
  getBooking,
  createBookingSchema,
  createBooking,
  rescheduleBookingSchema,
  rescheduleBooking,
  cancelBookingSchema,
  cancelBooking,
  confirmBookingSchema,
  confirmBooking,
} from "./tools/bookings.js";

import {
  getEventTypesSchema,
  getEventTypes,
  getEventTypeSchema,
  getEventType,
  createEventTypeSchema,
  createEventType,
  updateEventTypeSchema,
  updateEventType,
  deleteEventTypeSchema,
  deleteEventType,
} from "./tools/event-types.js";

import {
  getSchedulesSchema,
  getSchedules,
  getScheduleSchema,
  getSchedule,
  createScheduleSchema,
  createSchedule,
  updateScheduleSchema,
  updateSchedule,
  deleteScheduleSchema,
  deleteSchedule,
} from "./tools/schedules.js";

import { getAvailabilitySchema, getAvailability } from "./tools/availability.js";

import {
  getCalendarsSchema,
  getCalendars,
  getBusyTimesSchema,
  getBusyTimes,
} from "./tools/calendars.js";

import {
  getWebhooksSchema,
  getWebhooks,
  createWebhookSchema,
  createWebhook,
  deleteWebhookSchema,
  deleteWebhook,
} from "./tools/webhooks.js";

import { getMeSchema, getMe, updateMeSchema, updateMe } from "./tools/users.js";

async function main(): Promise<void> {
  const authMode = getAuthMode();
  console.error(`[mcp-server] Starting Cal.com MCP server (auth: ${authMode})`);

  if (authMode === "oauth") {
    initOAuthTokens();
  }

  const server = new McpServer({
    name: "calcom-mcp-server",
    version: "0.1.0",
  });

  // Bookings
  server.tool(
    "get_bookings",
    "List bookings with optional filters.",
    getBookingsSchema,
    getBookings
  );
  server.tool("get_booking", "Get a specific booking by UID.", getBookingSchema, getBooking);
  server.tool("create_booking", "Create a new booking.", createBookingSchema, createBooking);
  server.tool(
    "reschedule_booking",
    "Reschedule a booking.",
    rescheduleBookingSchema,
    rescheduleBooking
  );
  server.tool("cancel_booking", "Cancel a booking.", cancelBookingSchema, cancelBooking);
  server.tool(
    "confirm_booking",
    "Confirm a pending booking.",
    confirmBookingSchema,
    confirmBooking
  );

  // Event Types
  server.tool("get_event_types", "List all event types.", getEventTypesSchema, getEventTypes);
  server.tool(
    "get_event_type",
    "Get a specific event type by ID.",
    getEventTypeSchema,
    getEventType
  );
  server.tool(
    "create_event_type",
    "Create a new event type.",
    createEventTypeSchema,
    createEventType
  );
  server.tool("update_event_type", "Update an event type.", updateEventTypeSchema, updateEventType);
  server.tool("delete_event_type", "Delete an event type.", deleteEventTypeSchema, deleteEventType);

  // Schedules
  server.tool("get_schedules", "List all schedules.", getSchedulesSchema, getSchedules);
  server.tool("get_schedule", "Get a specific schedule by ID.", getScheduleSchema, getSchedule);
  server.tool("create_schedule", "Create a new schedule.", createScheduleSchema, createSchedule);
  server.tool("update_schedule", "Update a schedule.", updateScheduleSchema, updateSchedule);
  server.tool("delete_schedule", "Delete a schedule.", deleteScheduleSchema, deleteSchedule);

  // Availability / Slots
  server.tool(
    "get_availability",
    "Get available time slots (GET /v2/slots). Uses cal-api-version 2024-09-04.",
    getAvailabilitySchema,
    getAvailability
  );

  // Calendars
  server.tool("get_calendars", "List connected calendars.", getCalendarsSchema, getCalendars);
  server.tool("get_busy_times", "Get busy times from calendars.", getBusyTimesSchema, getBusyTimes);

  // Webhooks
  server.tool("get_webhooks", "List all webhooks.", getWebhooksSchema, getWebhooks);
  server.tool(
    "create_webhook",
    "Create a webhook subscription.",
    createWebhookSchema,
    createWebhook
  );
  server.tool("delete_webhook", "Delete a webhook.", deleteWebhookSchema, deleteWebhook);

  // User Profile
  server.tool("get_me", "Get authenticated user profile.", getMeSchema, getMe);
  server.tool("update_me", "Update user profile.", updateMeSchema, updateMe);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[mcp-server] Cal.com MCP server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-server] Fatal error:", err);
  process.exit(1);
});
