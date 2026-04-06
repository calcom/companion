import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

/**
 * Register all 34 Cal.com MCP tools on the given McpServer instance.
 * Shared between stdio and HTTP transports.
 */
export function registerTools(server: McpServer): void {
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
  server.tool("get_bookings", "List bookings. Supports filtering by status (upcoming, recurring, past, cancelled, unconfirmed), attendee, event type, team, date ranges, and sorting.", getBookingsSchema, getBookings);
  server.tool("get_booking", "Get a specific booking by UID.", getBookingSchema, getBooking);
  server.tool("create_booking", "Create a booking. Identify the event type by: (1) eventTypeId, OR (2) eventTypeSlug + username for individual events, OR (3) eventTypeSlug + teamSlug for team events. The 'start' time MUST be in UTC. The attendee is the person being booked, not the host.", createBookingSchema, createBooking);
  server.tool("reschedule_booking", "Reschedule a booking to a new time. Provide the new start time in UTC. If rescheduledBy matches the event owner's email the rescheduled booking is auto-confirmed.", rescheduleBookingSchema, rescheduleBooking);
  server.tool("cancel_booking", "Cancel a booking. For recurring bookings, set cancelSubsequentBookings=true to also cancel all future recurrences.", cancelBookingSchema, cancelBooking);
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
  server.tool("get_availability", "Get available time slots. Identify slots by: (1) eventTypeId, (2) eventTypeSlug + username, (3) eventTypeSlug + teamSlug, or (4) usernames (comma-separated, for dynamic events). Start/end must be in UTC ISO 8601.", getAvailabilitySchema, getAvailability);
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
}
