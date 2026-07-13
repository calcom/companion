import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
// ── Availability / Slots ──
import { getAvailability, getAvailabilitySchema } from "./tools/availability.js";
// ── Booking Routing Trace ──
import {
  getBookingRoutingTrace,
  getBookingRoutingTraceSchema,
} from "./tools/booking-routing-trace.js";

// ── Bookings ──
import {
  addBookingAttendee,
  addBookingAttendeeSchema,
  cancelBooking,
  cancelBookingSchema,
  confirmBooking,
  confirmBookingSchema,
  createBooking,
  createBookingSchema,
  getBooking,
  getBookingAttendee,
  getBookingAttendeeSchema,
  getBookingAttendees,
  getBookingAttendeesSchema,
  getBookingSchema,
  getBookings,
  getBookingsSchema,
  markBookingAbsent,
  markBookingAbsentSchema,
  rescheduleBooking,
  rescheduleBookingSchema,
} from "./tools/bookings.js";
// ── Calendars ──
import {
  getBusyTimes,
  getBusyTimesSchema,
  getConnectedCalendars,
  getConnectedCalendarsSchema,
} from "./tools/calendars.js";
// ── Conferencing ──
import { getConferencingApps, getConferencingAppsSchema } from "./tools/conferencing.js";
// ── Event Types ──
import {
  createEventType,
  createEventTypeSchema,
  deleteEventType,
  deleteEventTypeSchema,
  getCrmSyncErrors,
  getCrmSyncErrorsSchema,
  getEventType,
  getEventTypeHistory,
  getEventTypeHistorySchema,
  getEventTypeSchema,
  getEventTypes,
  getEventTypesSchema,
  getSchedulingConfig,
  getSchedulingConfigSchema,
  updateEventType,
  updateEventTypeSchema,
} from "./tools/event-types.js";
// ── Organizations: Attributes ──
import {
  assignAttributeToUser,
  assignAttributeToUserSchema,
  getAttributeOptions,
  getAttributeOptionsSchema,
  getOrgAttribute,
  getOrgAttributeSchema,
  getOrgAttributes,
  getOrgAttributesSchema,
  getUserAttributeHistory,
  getUserAttributeHistorySchema,
  getUserAttributes,
  getUserAttributesSchema,
  unassignAttributeFromUser,
  unassignAttributeFromUserSchema,
  updateUserAttribute,
  updateUserAttributeSchema,
} from "./tools/organizations/attributes.js";
// ── Organizations: Bookings ──
import {
  getOrgTeamBookings,
  getOrgTeamBookingsSchema,
  getOrgUserBookings,
  getOrgUserBookingsSchema,
} from "./tools/organizations/bookings.js";
// ── Organizations: Memberships ──
import {
  createOrgMembership,
  createOrgMembershipSchema,
  deleteOrgMembership,
  deleteOrgMembershipSchema,
  getOrgMembership,
  getOrgMembershipSchema,
  getOrgMemberships,
  getOrgMembershipsSchema,
  updateOrgMembership,
  updateOrgMembershipSchema,
} from "./tools/organizations/memberships.js";
// ── Organizations: Routing Forms ──
import {
  getOrgRoutingFormResponses,
  getOrgRoutingFormResponsesSchema,
  getOrgRoutingForms,
  getOrgRoutingFormsSchema,
} from "./tools/organizations/routing-forms.js";
// ── Organizations: Teams ──
import {
  getMyTeams,
  getMyTeamsSchema,
  getOrgTeams,
  getOrgTeamsSchema,
} from "./tools/organizations/teams.js";
// ── Routing Forms ──
import {
  calculateRoutingFormSlots,
  calculateRoutingFormSlotsSchema,
} from "./tools/routing-forms.js";
// ── Schedules ──
import {
  createSchedule,
  createScheduleSchema,
  deleteSchedule,
  deleteScheduleSchema,
  getDefaultSchedule,
  getDefaultScheduleSchema,
  getSchedule,
  getScheduleSchema,
  getSchedules,
  getSchedulesSchema,
  updateSchedule,
  updateScheduleSchema,
} from "./tools/schedules.js";
// ── Teams: Memberships ──
import {
  createTeamInvite,
  createTeamInviteSchema,
  createTeamMembership,
  createTeamMembershipSchema,
  deleteTeamMembership,
  deleteTeamMembershipSchema,
  getTeamMembership,
  getTeamMembershipSchema,
  getTeamMemberships,
  getTeamMembershipsSchema,
  updateTeamMembership,
  updateTeamMembershipSchema,
} from "./tools/teams/memberships.js";
// ── Users ──
import { getMe, getMeSchema, updateMe, updateMeSchema } from "./tools/users.js";

/**
 * Tool annotation presets matching MCP behaviour hints.
 *
 * All Cal.com tools call the external Cal.com API, so `openWorldHint` is always `true`.
 *
 * - READ_ONLY     — does not modify state (GET endpoints).
 * - CREATE        — creates new resources (POST). Not idempotent.
 * - UPDATE        — updates existing resources (PATCH/PUT). Idempotent, non-destructive.
 * - DESTRUCTIVE   — deletes/cancels resources (DELETE/cancel). Idempotent, destructive.
 *
 * @see https://modelcontextprotocol.io/specification/draft/server/tools#tool-annotations
 */
const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
};

const CREATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

const UPDATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

/**
 * Register all Cal.com MCP tools on the given McpServer instance.
 * Shared between stdio and HTTP transports.
 */
export function registerTools(server: McpServer): void {
  // ── Users (2) ──
  server.registerTool(
    "get_me",
    {
      title: "Get My Profile",
      description:
        "Get the authenticated user's profile including username, email, time zone, default schedule, and organizationId. Call this first when you need the user's own details (email, username, organizationId) for other tools.",
      inputSchema: getMeSchema,
      annotations: READ_ONLY,
    },
    getMe
  );
  server.registerTool(
    "update_me",
    {
      title: "Update My Profile",
      description:
        "Update the authenticated user's profile. Supports name, email, bio, time zone, week start, time format, default schedule, locale, avatar URL, and custom metadata.",
      inputSchema: updateMeSchema,
      annotations: UPDATE,
    },
    updateMe
  );

  // ── Event Types (8) ──
  server.registerTool(
    "get_event_types",
    {
      title: "List Event Types",
      description:
        "List event types. Without parameters returns all event types for the authenticated user. Pass 'username' to list another user's event types, or username + eventSlug for a specific one. Use usernames (comma-separated) for dynamic group event types.",
      inputSchema: getEventTypesSchema,
      annotations: READ_ONLY,
    },
    getEventTypes
  );
  server.registerTool(
    "get_event_type",
    {
      title: "Get Event Type",
      description:
        "Get a specific event type by its numeric ID (use get_event_types to find IDs). Returns full details including locations, booking fields, and schedule.",
      inputSchema: getEventTypeSchema,
      annotations: READ_ONLY,
    },
    getEventType
  );
  server.registerTool(
    "get_crm_sync_errors",
    {
      title: "List CRM Sync Errors",
      description:
        "List CRM sync errors for an event type and CRM app slug, such as salesforce. By default returns active/current errors only; set includeDismissed=true to include dismissed historical errors. Use eventTypeId plus appSlug, not credentialId. Supports cursor pagination via limit (1-100, default 50) and cursor. Requires read access to the event type.",
      inputSchema: getCrmSyncErrorsSchema,
      annotations: READ_ONLY,
    },
    getCrmSyncErrors
  );
  server.registerTool(
    "create_event_type",
    {
      title: "Create Event Type",
      description:
        "Create a new event type. Required: title, slug, lengthInMinutes. Supports locations, booking fields, buffers, recurrence, confirmation policy, seats, and more.",
      inputSchema: createEventTypeSchema,
      annotations: CREATE,
    },
    createEventType
  );
  server.registerTool(
    "update_event_type",
    {
      title: "Update Event Type",
      description:
        "Update an existing event type by ID (use get_event_types to find IDs). Any provided field replaces the current value. Array fields (locations, bookingFields) replace entirely — fetch the current event type first with get_event_type to avoid losing existing values.",
      inputSchema: updateEventTypeSchema,
      annotations: UPDATE,
    },
    updateEventType
  );
  server.registerTool(
    "delete_event_type",
    {
      title: "Delete Event Type",
      description:
        "Permanently delete an event type by ID. This action is irreversible — confirm with the user before proceeding.",
      inputSchema: deleteEventTypeSchema,
      annotations: DESTRUCTIVE,
    },
    deleteEventType
  );
  server.registerTool(
    "get_scheduling_config",
    {
      title: "Get Scheduling Config",
      description:
        "Get the scheduling configuration for a team event type. For roundRobin types: returns hosts (with priority, weight, mandatory status, group assignment), host groups, distribution settings (maxLeadThreshold), and advanced settings (weights enabled, no-show calculation, CRM fallback). For collective/managed types: returns hosts with basic info and assignAllTeamMembers. The event type must be a team event type — returns 422 otherwise.",
      inputSchema: getSchedulingConfigSchema,
      annotations: READ_ONLY,
    },
    getSchedulingConfig
  );
  server.registerTool(
    "get_event_type_history",
    {
      title: "Get Event Type History",
      description:
        "Get the audit history (change log) for an event type by ID (use get_event_types to find IDs). Returns audit log entries showing what changed, who made the change, when, and the previous/new field values, ordered most recent first. Supports cursor pagination via limit (1-50, default 25) and cursor. Requires audit-history access to the event type — general read access alone is not sufficient.",
      inputSchema: getEventTypeHistorySchema,
      annotations: READ_ONLY,
    },
    getEventTypeHistory
  );

  // ── Bookings (10) ──
  server.registerTool(
    "get_bookings",
    {
      title: "List Bookings",
      description:
        "List bookings with pagination (default 100, max 250 per page — use take/skip for more). Supports filtering by status (upcoming, recurring, past, cancelled, unconfirmed), attendee email/name, event type, team, date ranges (afterStart, beforeEnd), and sorting (sortStart, sortEnd, sortCreated).",
      inputSchema: getBookingsSchema,
      annotations: READ_ONLY,
    },
    getBookings
  );
  server.registerTool(
    "get_booking",
    {
      title: "Get Booking",
      description:
        "Get a specific booking by its UID (use get_bookings to find UIDs). Returns full details including attendees, location, and metadata.",
      inputSchema: getBookingSchema,
      annotations: READ_ONLY,
    },
    getBooking
  );
  server.registerTool(
    "create_booking",
    {
      title: "Create Booking",
      description:
        "Create a booking. WORKFLOW: (1) Use get_event_types to find the event type ID/slug. (2) Call get_availability to find open slots — NEVER pick a time without checking availability first. (3) If using bookingFieldsResponses, call get_event_type first to discover required custom fields. (4) For attendee details (name, email, timeZone), use get_me if booking for yourself, otherwise ASK THE USER — never guess or fabricate attendee info. Identify the event type by: eventTypeId, OR eventTypeSlug + username (individual), OR eventTypeSlug + teamSlug (team). The 'start' time MUST be in UTC ISO 8601. 'username' is the HOST whose calendar you are booking. 'attendee' is the GUEST (the caller).",
      inputSchema: createBookingSchema,
      annotations: CREATE,
    },
    createBooking
  );
  server.registerTool(
    "reschedule_booking",
    {
      title: "Reschedule Booking",
      description:
        "Reschedule a booking to a new time. WORKFLOW: (1) Call get_availability to find open slots — NEVER pick a new time without checking availability first. (2) The new start time must be in UTC ISO 8601. rescheduledBy is only needed for confirmation-required bookings — use the event owner's email (from get_me) for auto-confirmation. Never fabricate emails.",
      inputSchema: rescheduleBookingSchema,
      annotations: UPDATE,
    },
    rescheduleBooking
  );
  server.registerTool(
    "cancel_booking",
    {
      title: "Cancel Booking",
      description:
        "Cancel a booking by UID. For recurring non-seated bookings, set cancelSubsequentBookings=true to cancel future recurrences. For seated bookings, pass seatUid to cancel a specific seat instead of the entire booking. Confirm with the user before cancelling.",
      inputSchema: cancelBookingSchema,
      annotations: DESTRUCTIVE,
    },
    cancelBooking
  );
  server.registerTool(
    "confirm_booking",
    {
      title: "Confirm Booking",
      description:
        "Confirm a pending booking that requires manual confirmation. Only the host can confirm.",
      inputSchema: confirmBookingSchema,
      annotations: UPDATE,
    },
    confirmBooking
  );
  server.registerTool(
    "mark_booking_absent",
    {
      title: "Mark Booking Absent",
      description:
        "Mark host or attendees as absent for a past booking. Set host=true if the host was absent. Use get_booking_attendees to look up real attendee emails before calling this.",
      inputSchema: markBookingAbsentSchema,
      annotations: UPDATE,
    },
    markBookingAbsent
  );
  server.registerTool(
    "get_booking_attendees",
    {
      title: "List Booking Attendees",
      description: "Get all attendees for a booking by its UID.",
      inputSchema: getBookingAttendeesSchema,
      annotations: READ_ONLY,
    },
    getBookingAttendees
  );
  server.registerTool(
    "add_booking_attendee",
    {
      title: "Add Booking Attendee",
      description:
        "Add a new attendee to an existing booking. Required: name, email, timeZone. ASK THE USER for all attendee details — never guess or fabricate names, emails, or time zones.",
      inputSchema: addBookingAttendeeSchema,
      annotations: CREATE,
    },
    addBookingAttendee
  );
  server.registerTool(
    "get_booking_attendee",
    {
      title: "Get Booking Attendee",
      description:
        "Get a specific attendee by their numeric ID within a booking. Use get_booking_attendees to find attendee IDs.",
      inputSchema: getBookingAttendeeSchema,
      annotations: READ_ONLY,
    },
    getBookingAttendee
  );

  // ── Schedules (6) ──
  server.registerTool(
    "get_schedules",
    {
      title: "List Schedules",
      description: "List all schedules for the authenticated user.",
      inputSchema: getSchedulesSchema,
      annotations: READ_ONLY,
    },
    getSchedules
  );
  server.registerTool(
    "get_schedule",
    {
      title: "Get Schedule",
      description:
        "Get a specific schedule by its numeric ID. Returns availability slots and overrides.",
      inputSchema: getScheduleSchema,
      annotations: READ_ONLY,
    },
    getSchedule
  );
  server.registerTool(
    "create_schedule",
    {
      title: "Create Schedule",
      description:
        "Create a new schedule. Required: name, timeZone, isDefault. Each user should have exactly one default schedule. Supports availability slots and date-specific overrides.",
      inputSchema: createScheduleSchema,
      annotations: CREATE,
    },
    createSchedule
  );
  server.registerTool(
    "update_schedule",
    {
      title: "Update Schedule",
      description:
        "Update an existing schedule. Array fields (availability, overrides) replace all existing entries.",
      inputSchema: updateScheduleSchema,
      annotations: UPDATE,
    },
    updateSchedule
  );
  server.registerTool(
    "delete_schedule",
    {
      title: "Delete Schedule",
      description:
        "Delete a schedule by its numeric ID. This action is irreversible — confirm with the user before proceeding.",
      inputSchema: deleteScheduleSchema,
      annotations: DESTRUCTIVE,
    },
    deleteSchedule
  );
  server.registerTool(
    "get_default_schedule",
    {
      title: "Get Default Schedule",
      description: "Get the authenticated user's default schedule.",
      inputSchema: getDefaultScheduleSchema,
      annotations: READ_ONLY,
    },
    getDefaultSchedule
  );

  // ── Availability / Slots (1) ──
  server.registerTool(
    "get_availability",
    {
      title: "Get Availability",
      description:
        "Get available time slots for a host. You MUST provide at least one identifier: (1) eventTypeId, (2) eventTypeSlug + username, (3) eventTypeSlug + teamSlug, or (4) usernames (comma-separated, min 2, for dynamic events). 'username' is the host whose availability you are checking. Start/end must be in UTC ISO 8601.",
      inputSchema: getAvailabilitySchema,
      annotations: READ_ONLY,
    },
    getAvailability
  );

  // ── Calendars (2) ──
  server.registerTool(
    "get_connected_calendars",
    {
      title: "List Connected Calendars",
      description:
        "List all calendar integrations connected to the authenticated user's account. Returns each calendar's credentialId and externalId, which are required by get_busy_times. Also shows the user's destination calendar.",
      inputSchema: getConnectedCalendarsSchema,
      annotations: READ_ONLY,
    },
    getConnectedCalendars
  );
  server.registerTool(
    "get_busy_times",
    {
      title: "Get Busy Times",
      description:
        "Get busy/blocked time blocks from a connected calendar (e.g. Google Calendar) between two dates. Returns a list of time ranges when the user is unavailable. Required: dateFrom, dateTo (YYYY-MM-DD), credentialId, and externalId. WORKFLOW: (1) Call get_connected_calendars first to get the real credentialId (number) and externalId (e.g. email) for the calendar — NEVER guess or fabricate these. (2) Provide dateFrom and dateTo as YYYY-MM-DD strings. (3) Optionally pass timeZone (IANA, e.g. 'America/New_York') to localise the results.",
      inputSchema: getBusyTimesSchema,
      annotations: READ_ONLY,
    },
    getBusyTimes
  );

  // ── Conferencing (1) ──
  server.registerTool(
    "get_conferencing_apps",
    {
      title: "List Conferencing Apps",
      description:
        "List all conferencing applications connected to the authenticated user's account (e.g. Zoom, Google Meet, Cal Video).",
      inputSchema: getConferencingAppsSchema,
      annotations: READ_ONLY,
    },
    getConferencingApps
  );

  // ── Booking Routing Trace (1) ──
  server.registerTool(
    "get_booking_routing_trace",
    {
      title: "Get Booking Routing Trace",
      description:
        "Get the routing trace for a booking — the step-by-step decision path showing how the booking was routed (routing form evaluation, CRM lookups, host selection). Returns human-readable steps grouped by round, plus the routing form submission answers. Only available for bookings that completed routing (permanent traces). Use get_bookings to find booking UIDs.",
      inputSchema: getBookingRoutingTraceSchema,
      annotations: READ_ONLY,
    },
    getBookingRoutingTrace
  );

  // ── Routing Forms (1) ──
  server.registerTool(
    "calculate_routing_form_slots",
    {
      title: "Calculate Routing Form Slots",
      description:
        "Submit a routing form response and get available slots. The response object contains the user's answers (keys are routing form field slugs/IDs). Use get_org_routing_forms to find routingFormId. Start/end must be in UTC ISO 8601.",
      inputSchema: calculateRoutingFormSlotsSchema,
      annotations: CREATE,
    },
    calculateRoutingFormSlots
  );

  // ── Organizations: Attributes (8) ──
  server.registerTool(
    "get_org_attributes",
    {
      title: "List Org Attributes",
      description:
        "List all attributes defined for an organization. Attributes are custom fields (TEXT, NUMBER, SINGLE_SELECT, MULTI_SELECT) used to tag members for routing and round-robin. Supports pagination with skip/take.",
      inputSchema: getOrgAttributesSchema,
      annotations: READ_ONLY,
    },
    getOrgAttributes
  );
  server.registerTool(
    "get_org_attribute",
    {
      title: "Get Org Attribute",
      description:
        "Get a single organization attribute by ID. Use get_org_attributes to find attribute IDs and get_attribute_options to list available options.",
      inputSchema: getOrgAttributeSchema,
      annotations: READ_ONLY,
    },
    getOrgAttribute
  );
  server.registerTool(
    "get_attribute_options",
    {
      title: "List Attribute Options",
      description:
        "List all available options for a SINGLE_SELECT or MULTI_SELECT attribute. Returns option IDs and values needed when assigning attributes to users via assign_attribute_to_user.",
      inputSchema: getAttributeOptionsSchema,
      annotations: READ_ONLY,
    },
    getAttributeOptions
  );
  server.registerTool(
    "get_user_attributes",
    {
      title: "Get User Attributes",
      description:
        "Get all attribute options assigned to a specific user within an organization. Returns grouped attributes with their assigned option values and weights.",
      inputSchema: getUserAttributesSchema,
      annotations: READ_ONLY,
    },
    getUserAttributes
  );
  server.registerTool(
    "get_user_attribute_history",
    {
      title: "Get User Attribute History",
      description:
        "Get the attribute assignment history (audit log) for a user within an organization. Returns a chronological log of attribute assignment changes (assigned, updated, unassigned). Supports pagination with limit (1-50) and cursor. Requires org admin role.",
      inputSchema: getUserAttributeHistorySchema,
      annotations: READ_ONLY,
    },
    getUserAttributeHistory
  );
  server.registerTool(
    "assign_attribute_to_user",
    {
      title: "Assign Attribute to User",
      description:
        "Assign an attribute option to a user. For SINGLE_SELECT/MULTI_SELECT attributes, pass attributeOptionId (use get_attribute_options to list available options). For TEXT/NUMBER attributes, pass value instead to create an option on the fly. Optionally set a weight for round-robin routing.",
      inputSchema: assignAttributeToUserSchema,
      annotations: CREATE,
    },
    assignAttributeToUser
  );
  server.registerTool(
    "update_user_attribute",
    {
      title: "Update User Attribute Assignment",
      description:
        "Update an existing attribute assignment for a user (e.g. change the weight). Use get_user_attributes to find the attributeOptionId.",
      inputSchema: updateUserAttributeSchema,
      annotations: UPDATE,
    },
    updateUserAttribute
  );
  server.registerTool(
    "unassign_attribute_from_user",
    {
      title: "Unassign Attribute from User",
      description:
        "Remove an attribute option assignment from a user. Use get_user_attributes to find the attributeOptionId. Confirm with the user before proceeding.",
      inputSchema: unassignAttributeFromUserSchema,
      annotations: DESTRUCTIVE,
    },
    unassignAttributeFromUser
  );

  // ── Organizations: Bookings (2) ──
  server.registerTool(
    "get_org_team_bookings",
    {
      title: "List Org Team Bookings",
      description:
        "List all bookings for a team within an organization. Requires TEAM_ADMIN role. Supports filtering by status (upcoming, recurring, past, cancelled, unconfirmed), attendee email/name, event type, date ranges (afterStart, beforeEnd, afterCreatedAt, beforeCreatedAt, afterUpdatedAt, beforeUpdatedAt), and sorting (sortStart, sortEnd, sortCreated, sortUpdatedAt).",
      inputSchema: getOrgTeamBookingsSchema,
      annotations: READ_ONLY,
    },
    getOrgTeamBookings
  );
  server.registerTool(
    "get_org_user_bookings",
    {
      title: "List Org User Bookings",
      description:
        "List all bookings for a specific user within an organization. Requires ORG_ADMIN role. Use get_org_memberships to find user IDs. Supports filtering by status, attendee email/name, event type, team, date ranges, and sorting.",
      inputSchema: getOrgUserBookingsSchema,
      annotations: READ_ONLY,
    },
    getOrgUserBookings
  );

  // ── Organizations: Memberships (5) ──
  server.registerTool(
    "get_org_memberships",
    {
      title: "List Org Memberships",
      description:
        "List all memberships in an organization. Supports pagination with take/skip (take max 250).",
      inputSchema: getOrgMembershipsSchema,
      annotations: READ_ONLY,
    },
    getOrgMemberships
  );
  server.registerTool(
    "create_org_membership",
    {
      title: "Create Org Membership",
      description:
        "Add a user to an organization or invite by email. WORKFLOW: (1) To invite by email, pass 'email' and 'role'. (2) To attach by user ID, pass 'userId' and 'role'. Provide userId OR email, not both. Invites may auto-accept or remain pending based on org settings. Platform managed users should only have MEMBER role.",
      inputSchema: createOrgMembershipSchema,
      annotations: CREATE,
    },
    createOrgMembership
  );
  server.registerTool(
    "get_org_membership",
    {
      title: "Get Org Membership",
      description: "Get a specific organization membership by its numeric ID.",
      inputSchema: getOrgMembershipSchema,
      annotations: READ_ONLY,
    },
    getOrgMembership
  );
  server.registerTool(
    "delete_org_membership",
    {
      title: "Delete Org Membership",
      description:
        "Remove a membership from an organization. This action is irreversible — confirm with the user before proceeding.",
      inputSchema: deleteOrgMembershipSchema,
      annotations: DESTRUCTIVE,
    },
    deleteOrgMembership
  );
  server.registerTool(
    "update_org_membership",
    {
      title: "Update Org Membership",
      description:
        "Update an organization membership. Can change role, accepted status, or impersonation settings.",
      inputSchema: updateOrgMembershipSchema,
      annotations: UPDATE,
    },
    updateOrgMembership
  );

  // ── Organizations: Teams (2) ──
  server.registerTool(
    "get_org_teams",
    {
      title: "List All Org Teams",
      description:
        "List all teams in an organization. Supports take/skip pagination (take max 250). Requires ORG_ADMIN role. Use get_me to obtain your organizationId. Returns team IDs, names, and slugs needed by other team-scoped tools. If this fails with 403, use get_my_teams instead.",
      inputSchema: getOrgTeamsSchema,
      annotations: READ_ONLY,
    },
    getOrgTeams
  );
  server.registerTool(
    "get_my_teams",
    {
      title: "List My Teams",
      description:
        "List teams the authenticated user belongs to. Supports take/skip pagination (take max 250). Works for any org member (org admins see all teams). Use get_me to obtain your organizationId. Returns team IDs, names, and slugs needed by other team-scoped tools.",
      inputSchema: getMyTeamsSchema,
      annotations: READ_ONLY,
    },
    getMyTeams
  );

  // ── Organizations: Routing Forms (2) ──
  server.registerTool(
    "get_org_routing_forms",
    {
      title: "List Org Routing Forms",
      description:
        "List routing forms for an organization. Supports filtering by team IDs, date ranges, routed booking UID, and sorting.",
      inputSchema: getOrgRoutingFormsSchema,
      annotations: READ_ONLY,
    },
    getOrgRoutingForms
  );
  server.registerTool(
    "get_org_routing_form_responses",
    {
      title: "List Org Routing Form Responses",
      description:
        "Get responses for a specific routing form. Supports filtering by date ranges, routed booking UID, and sorting.",
      inputSchema: getOrgRoutingFormResponsesSchema,
      annotations: READ_ONLY,
    },
    getOrgRoutingFormResponses
  );

  // ── Teams: Memberships (6) ──
  server.registerTool(
    "get_team_memberships",
    {
      title: "List Team Memberships",
      description:
        "List all memberships in a team. Supports pagination with take/skip (take max 250) and filtering by up to 20 email addresses.",
      inputSchema: getTeamMembershipsSchema,
      annotations: READ_ONLY,
    },
    getTeamMemberships
  );
  server.registerTool(
    "get_team_membership",
    {
      title: "Get Team Membership",
      description:
        "Get a specific team membership by its numeric ID. Use get_team_memberships to find this — never guess.",
      inputSchema: getTeamMembershipSchema,
      annotations: READ_ONLY,
    },
    getTeamMembership
  );
  server.registerTool(
    "create_team_membership",
    {
      title: "Create Team Membership",
      description:
        "Add a user to a team. Required: userId (must be a real user ID from the system). Optional: role (defaults to MEMBER), accepted, disableImpersonation. Ask the user for the userId — never guess.",
      inputSchema: createTeamMembershipSchema,
      annotations: CREATE,
    },
    createTeamMembership
  );
  server.registerTool(
    "update_team_membership",
    {
      title: "Update Team Membership",
      description:
        "Update a team membership. Can change accepted status, role, or impersonation settings. Use get_team_memberships to find the membershipId — never guess.",
      inputSchema: updateTeamMembershipSchema,
      annotations: UPDATE,
    },
    updateTeamMembership
  );
  server.registerTool(
    "delete_team_membership",
    {
      title: "Delete Team Membership",
      description:
        "Remove a user from a team. This action is irreversible — confirm with the user before proceeding. Use get_team_memberships to find the membershipId — never guess.",
      inputSchema: deleteTeamMembershipSchema,
      annotations: DESTRUCTIVE,
    },
    deleteTeamMembership
  );
  server.registerTool(
    "create_team_invite",
    {
      title: "Create Team Invite",
      description:
        "Generate an invite link for a team. Returns a URL that can be shared with users to join the team.",
      inputSchema: createTeamInviteSchema,
      annotations: CREATE,
    },
    createTeamInvite
  );
}
