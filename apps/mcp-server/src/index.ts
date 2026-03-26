#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthMode, initOAuthTokens } from "./auth.js";
import type { AuthMode } from "./auth.js";

// ── Users ──
import { getMeSchema, getMe, updateMeSchema, updateMe } from "./tools/users.js";

// ── Event Types ──
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

// ── Bookings ──
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
  markBookingAbsentSchema,
  markBookingAbsent,
  getBookingAttendeesSchema,
  getBookingAttendees,
  addBookingAttendeeSchema,
  addBookingAttendee,
  getBookingAttendeeSchema,
  getBookingAttendee,
} from "./tools/bookings.js";

// ── Schedules ──
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
  getDefaultScheduleSchema,
  getDefaultSchedule,
} from "./tools/schedules.js";

// ── Availability / Slots ──
import { getAvailabilitySchema, getAvailability } from "./tools/availability.js";

// ── Calendars (busy times) ──
import { getBusyTimesSchema, getBusyTimes } from "./tools/calendars.js";

// ── Conferencing ──
import { getConferencingAppsSchema, getConferencingApps } from "./tools/conferencing.js";

// ── Routing Forms ──
import {
  calculateRoutingFormSlotsSchema,
  calculateRoutingFormSlots,
} from "./tools/routing-forms.js";

// ── Organizations: Memberships ──
import {
  getOrgMembershipsSchema,
  getOrgMemberships,
  createOrgMembershipSchema,
  createOrgMembership,
  getOrgMembershipSchema,
  getOrgMembership,
  deleteOrgMembershipSchema,
  deleteOrgMembership,
} from "./tools/organizations/memberships.js";

// ── Organizations: Routing Forms ──
import {
  getOrgRoutingFormsSchema,
  getOrgRoutingForms,
  getOrgRoutingFormResponsesSchema,
  getOrgRoutingFormResponses,
} from "./tools/organizations/routing-forms.js";

async function main(): Promise<void> {
  const authMode: AuthMode = getAuthMode();
  console.error(`[mcp-server] Starting Cal.com MCP server (auth: ${authMode})`);

  if (authMode === "oauth") {
    initOAuthTokens();
  }

  // In hosted mode, initialize the database and start the OAuth HTTP server
  if (authMode === "hosted") {
    const { getDb } = await import("./storage/db.js");
    getDb(); // initialize DB + create tables
    const { startOAuthServer } = await import("./oauth/routes.js");
    const port = Number.parseInt(process.env.PORT || "3100", 10);
    startOAuthServer(port);
  }

  const server = new McpServer({
    name: "calcom-mcp-server",
    version: "0.1.0",
  });

  // ── Users (2) ──
  server.tool("get_me", "Get authenticated user profile.", getMeSchema, getMe);
  server.tool("update_me", "Update user profile.", updateMeSchema, updateMe);

  // ── Event Types (5) ──
  server.tool("get_event_types", "List all event types.", getEventTypesSchema, getEventTypes);
  server.tool("get_event_type", "Get a specific event type by ID.", getEventTypeSchema, getEventType);
  server.tool("create_event_type", "Create a new event type.", createEventTypeSchema, createEventType);
  server.tool("update_event_type", "Update an event type.", updateEventTypeSchema, updateEventType);
  server.tool("delete_event_type", "Delete an event type.", deleteEventTypeSchema, deleteEventType);

  // ── Bookings (10) ──
  server.tool("get_bookings", "List bookings with optional filters.", getBookingsSchema, getBookings);
  server.tool("get_booking", "Get a specific booking by UID.", getBookingSchema, getBooking);
  server.tool("create_booking", "Create a new booking.", createBookingSchema, createBooking);
  server.tool("reschedule_booking", "Reschedule a booking.", rescheduleBookingSchema, rescheduleBooking);
  server.tool("cancel_booking", "Cancel a booking.", cancelBookingSchema, cancelBooking);
  server.tool("confirm_booking", "Confirm a pending booking.", confirmBookingSchema, confirmBooking);
  server.tool("mark_booking_absent", "Mark a booking absence.", markBookingAbsentSchema, markBookingAbsent);
  server.tool("get_booking_attendees", "Get all attendees for a booking.", getBookingAttendeesSchema, getBookingAttendees);
  server.tool("add_booking_attendee", "Add an attendee to a booking.", addBookingAttendeeSchema, addBookingAttendee);
  server.tool("get_booking_attendee", "Get a specific attendee for a booking.", getBookingAttendeeSchema, getBookingAttendee);

  // ── Schedules (6) ──
  server.tool("get_schedules", "List all schedules.", getSchedulesSchema, getSchedules);
  server.tool("get_schedule", "Get a specific schedule by ID.", getScheduleSchema, getSchedule);
  server.tool("create_schedule", "Create a new schedule.", createScheduleSchema, createSchedule);
  server.tool("update_schedule", "Update a schedule.", updateScheduleSchema, updateSchedule);
  server.tool("delete_schedule", "Delete a schedule.", deleteScheduleSchema, deleteSchedule);
  server.tool("get_default_schedule", "Get default schedule.", getDefaultScheduleSchema, getDefaultSchedule);

  // ── Availability / Slots (2) ──
  server.tool("get_availability", "Get available time slots (GET /v2/slots). Uses cal-api-version 2024-09-04.", getAvailabilitySchema, getAvailability);
  server.tool("get_busy_times", "Get busy times from calendars.", getBusyTimesSchema, getBusyTimes);

  // ── Conferencing (1) ──
  server.tool("get_conferencing_apps", "List conferencing applications.", getConferencingAppsSchema, getConferencingApps);

  // ── Routing Forms (1) ──
  server.tool("calculate_routing_form_slots", "Calculate slots based on routing form response.", calculateRoutingFormSlotsSchema, calculateRoutingFormSlots);

  // ── Organizations: Memberships (4) ──
  server.tool("get_org_memberships", "Get all organization memberships.", getOrgMembershipsSchema, getOrgMemberships);
  server.tool("create_org_membership", "Create an organization membership.", createOrgMembershipSchema, createOrgMembership);
  server.tool("get_org_membership", "Get an organization membership.", getOrgMembershipSchema, getOrgMembership);
  server.tool("delete_org_membership", "Delete an organization membership.", deleteOrgMembershipSchema, deleteOrgMembership);

  // ── Organizations: Routing Forms (2) ──
  server.tool("get_org_routing_forms", "Get organization routing forms.", getOrgRoutingFormsSchema, getOrgRoutingForms);
  server.tool("get_org_routing_form_responses", "Get routing form responses.", getOrgRoutingFormResponsesSchema, getOrgRoutingFormResponses);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[mcp-server] Cal.com MCP server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-server] Fatal error:", err);
  process.exit(1);
});
