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

// ── Calendars ──
import { getConnectedCalendarsSchema, getConnectedCalendars, getBusyTimesSchema, getBusyTimes } from "./tools/calendars.js";

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
  updateOrgMembershipSchema,
  updateOrgMembership,
} from "./tools/organizations/memberships.js";

// ── Organizations: Routing Forms ──
import {
  getOrgRoutingFormsSchema,
  getOrgRoutingForms,
  getOrgRoutingFormResponsesSchema,
  getOrgRoutingFormResponses,
} from "./tools/organizations/routing-forms.js";

/**
 * Register all Cal.com MCP tools on the given McpServer instance.
 * Shared between stdio and HTTP transports.
 */
export function registerTools(server: McpServer): void {
  // ── Users (2) ──
  server.tool("get_me", "Get the authenticated user's profile including username, email, time zone, default schedule, and organizationId. Call this first when you need the user's own details (email, username, organizationId) for other tools.", getMeSchema, getMe);
  server.tool("update_me", "Update the authenticated user's profile. Supports name, email, bio, time zone, week start, time format, default schedule, locale, avatar URL, and custom metadata.", updateMeSchema, updateMe);

  // ── Event Types (5) ──
  server.tool("get_event_types", "List event types. Without parameters returns all event types for the authenticated user. Pass 'username' to list another user's event types, or username + eventSlug for a specific one. Use usernames (comma-separated) for dynamic group event types.", getEventTypesSchema, getEventTypes);
  server.tool("get_event_type", "Get a specific event type by its numeric ID (use get_event_types to find IDs). Returns full details including locations, booking fields, and schedule.", getEventTypeSchema, getEventType);
  server.tool("create_event_type", "Create a new event type. Required: title, slug, lengthInMinutes. Supports locations, booking fields, buffers, recurrence, confirmation policy, seats, and more.", createEventTypeSchema, createEventType);
  server.tool("update_event_type", "Update an existing event type by ID (use get_event_types to find IDs). Any provided field replaces the current value. Array fields (locations, bookingFields) replace entirely — fetch the current event type first with get_event_type to avoid losing existing values.", updateEventTypeSchema, updateEventType);
  server.tool("delete_event_type", "Permanently delete an event type by ID. This action is irreversible — confirm with the user before proceeding.", deleteEventTypeSchema, deleteEventType);

  // ── Bookings (10) ──
  server.tool("get_bookings", "List bookings with pagination (default 100, max 250 per page — use take/skip for more). Supports filtering by status (upcoming, recurring, past, cancelled, unconfirmed), attendee email/name, event type, team, date ranges (afterStart, beforeEnd), and sorting (sortStart, sortEnd, sortCreated).", getBookingsSchema, getBookings);
  server.tool("get_booking", "Get a specific booking by its UID (use get_bookings to find UIDs). Returns full details including attendees, location, and metadata.", getBookingSchema, getBooking);
  server.tool("create_booking", "Create a booking. WORKFLOW: (1) Use get_event_types to find the event type ID/slug. (2) Call get_availability to find open slots — NEVER pick a time without checking availability first. (3) If using bookingFieldsResponses, call get_event_type first to discover required custom fields. (4) For attendee details (name, email, timeZone), use get_me if booking for yourself, otherwise ASK THE USER — never guess or fabricate attendee info. Identify the event type by: eventTypeId, OR eventTypeSlug + username (individual), OR eventTypeSlug + teamSlug (team). The 'start' time MUST be in UTC ISO 8601. 'username' is the HOST whose calendar you are booking. 'attendee' is the GUEST (the caller).", createBookingSchema, createBooking);
  server.tool("reschedule_booking", "Reschedule a booking to a new time. WORKFLOW: (1) Call get_availability to find open slots — NEVER pick a new time without checking availability first. (2) The new start time must be in UTC ISO 8601. rescheduledBy is only needed for confirmation-required bookings — use the event owner's email (from get_me) for auto-confirmation. Never fabricate emails.", rescheduleBookingSchema, rescheduleBooking);
  server.tool("cancel_booking", "Cancel a booking by UID. For recurring non-seated bookings, set cancelSubsequentBookings=true to cancel future recurrences. For seated bookings, pass seatUid to cancel a specific seat instead of the entire booking. Confirm with the user before cancelling.", cancelBookingSchema, cancelBooking);
  server.tool("confirm_booking", "Confirm a pending booking that requires manual confirmation. Only the host can confirm.", confirmBookingSchema, confirmBooking);
  server.tool("mark_booking_absent", "Mark host or attendees as absent for a past booking. Set host=true if the host was absent. Use get_booking_attendees to look up real attendee emails before calling this.", markBookingAbsentSchema, markBookingAbsent);
  server.tool("get_booking_attendees", "Get all attendees for a booking by its UID.", getBookingAttendeesSchema, getBookingAttendees);
  server.tool("add_booking_attendee", "Add a new attendee to an existing booking. Required: name, email, timeZone. ASK THE USER for all attendee details — never guess or fabricate names, emails, or time zones.", addBookingAttendeeSchema, addBookingAttendee);
  server.tool("get_booking_attendee", "Get a specific attendee by their numeric ID within a booking. Use get_booking_attendees to find attendee IDs.", getBookingAttendeeSchema, getBookingAttendee);

  // ── Schedules (6) ──
  server.tool("get_schedules", "List all schedules for the authenticated user.", getSchedulesSchema, getSchedules);
  server.tool("get_schedule", "Get a specific schedule by its numeric ID. Returns availability slots and overrides.", getScheduleSchema, getSchedule);
  server.tool("create_schedule", "Create a new schedule. Required: name, timeZone, isDefault. Each user should have exactly one default schedule. Supports availability slots and date-specific overrides.", createScheduleSchema, createSchedule);
  server.tool("update_schedule", "Update an existing schedule. Array fields (availability, overrides) replace all existing entries.", updateScheduleSchema, updateSchedule);
  server.tool("delete_schedule", "Delete a schedule by its numeric ID. This action is irreversible — confirm with the user before proceeding.", deleteScheduleSchema, deleteSchedule);
  server.tool("get_default_schedule", "Get the authenticated user's default schedule.", getDefaultScheduleSchema, getDefaultSchedule);

  // ── Availability / Slots (2) ──
  server.tool("get_availability", "Get available time slots for a host. You MUST provide at least one identifier: (1) eventTypeId, (2) eventTypeSlug + username, (3) eventTypeSlug + teamSlug, or (4) usernames (comma-separated, min 2, for dynamic events). 'username' is the host whose availability you are checking. Start/end must be in UTC ISO 8601.", getAvailabilitySchema, getAvailability);

  // ── Calendars (2) ──
  server.tool("get_connected_calendars", "List all calendar integrations connected to the authenticated user's account. Returns each calendar's credentialId and externalId, which are required by get_busy_times. Also shows the user's destination calendar.", getConnectedCalendarsSchema, getConnectedCalendars);
  server.tool("get_busy_times", "Get busy/blocked time blocks from a connected calendar (e.g. Google Calendar) between two dates. Returns a list of time ranges when the user is unavailable. Required: dateFrom, dateTo (YYYY-MM-DD), credentialId, and externalId. WORKFLOW: (1) Call get_connected_calendars first to get the real credentialId (number) and externalId (e.g. email) for the calendar — NEVER guess or fabricate these. (2) Provide dateFrom and dateTo as YYYY-MM-DD strings. (3) Optionally pass timeZone (IANA, e.g. 'America/New_York') to localise the results.", getBusyTimesSchema, getBusyTimes);

  // ── Conferencing (1) ──
  server.tool("get_conferencing_apps", "List all conferencing applications connected to the authenticated user's account (e.g. Zoom, Google Meet, Cal Video).", getConferencingAppsSchema, getConferencingApps);

  // ── Routing Forms (1) ──
  server.tool("calculate_routing_form_slots", "Submit a routing form response and get available slots. The response object contains the user's answers (keys are routing form field slugs/IDs). Use get_org_routing_forms to find routingFormId. Start/end must be in UTC ISO 8601.", calculateRoutingFormSlotsSchema, calculateRoutingFormSlots);

  // ── Organizations: Memberships (5) ──
  server.tool("get_org_memberships", "List all memberships in an organization. Supports pagination with take/skip.", getOrgMembershipsSchema, getOrgMemberships);
  server.tool("create_org_membership", "Add a user to an organization. Required: userId (must be a real user ID from the system) and role (MEMBER, ADMIN, or OWNER). Platform managed users should only have MEMBER role.", createOrgMembershipSchema, createOrgMembership);
  server.tool("get_org_membership", "Get a specific organization membership by its numeric ID.", getOrgMembershipSchema, getOrgMembership);
  server.tool("delete_org_membership", "Remove a membership from an organization. This action is irreversible — confirm with the user before proceeding.", deleteOrgMembershipSchema, deleteOrgMembership);
  server.tool("update_org_membership", "Update an organization membership. Can change role, accepted status, or impersonation settings.", updateOrgMembershipSchema, updateOrgMembership);

  // ── Organizations: Routing Forms (2) ──
  server.tool("get_org_routing_forms", "List routing forms for an organization. Supports filtering by team IDs, date ranges, routed booking UID, and sorting.", getOrgRoutingFormsSchema, getOrgRoutingForms);
  server.tool("get_org_routing_form_responses", "Get responses for a specific routing form. Supports filtering by date ranges, routed booking UID, and sorting.", getOrgRoutingFormResponsesSchema, getOrgRoutingFormResponses);
}
