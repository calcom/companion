#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthMode, initOAuthTokens } from "./auth.js";
import type { AuthMode } from "./auth.js";

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
  getBookingBySeatSchema,
  getBookingBySeat,
  getBookingRecordingsSchema,
  getBookingRecordings,
  getBookingTranscriptsSchema,
  getBookingTranscripts,
  markBookingAbsentSchema,
  markBookingAbsent,
  reassignBookingSchema,
  reassignBooking,
  reassignBookingToUserSchema,
  reassignBookingToUser,
  declineBookingSchema,
  declineBooking,
  getBookingCalendarLinksSchema,
  getBookingCalendarLinks,
  getBookingReferencesSchema,
  getBookingReferences,
  getBookingConferencingSessionsSchema,
  getBookingConferencingSessions,
  updateBookingLocationSchema,
  updateBookingLocation,
  getBookingAttendeesSchema,
  getBookingAttendees,
  addBookingAttendeeSchema,
  addBookingAttendee,
  getBookingAttendeeSchema,
  getBookingAttendee,
  addBookingGuestsSchema,
  addBookingGuests,
} from "./tools/bookings.js";

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
  createEventTypeWebhookSchema,
  createEventTypeWebhook,
  getEventTypeWebhooksSchema,
  getEventTypeWebhooks,
  deleteAllEventTypeWebhooksSchema,
  deleteAllEventTypeWebhooks,
  updateEventTypeWebhookSchema,
  updateEventTypeWebhook,
  getEventTypeWebhookSchema,
  getEventTypeWebhook,
  deleteEventTypeWebhookSchema,
  deleteEventTypeWebhook,
  createEventTypePrivateLinkSchema,
  createEventTypePrivateLink,
  getEventTypePrivateLinksSchema,
  getEventTypePrivateLinks,
  updateEventTypePrivateLinkSchema,
  updateEventTypePrivateLink,
  deleteEventTypePrivateLinkSchema,
  deleteEventTypePrivateLink,
} from "./tools/event-types.js";

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
import {
  getAvailabilitySchema,
  getAvailability,
  reserveSlotSchema,
  reserveSlot,
  getSlotReservationSchema,
  getSlotReservation,
  updateSlotReservationSchema,
  updateSlotReservation,
  deleteSlotReservationSchema,
  deleteSlotReservation,
} from "./tools/availability.js";

// ── Calendars ──
import {
  getCalendarsSchema,
  getCalendars,
  getBusyTimesSchema,
  getBusyTimes,
  getCalendarConnectionsSchema,
  getCalendarConnections,
  getConnectionEventsSchema,
  getConnectionEvents,
  createConnectionEventSchema,
  createConnectionEvent,
  getConnectionEventSchema,
  getConnectionEvent,
  updateConnectionEventSchema,
  updateConnectionEvent,
  deleteConnectionEventSchema,
  deleteConnectionEvent,
  getConnectionFreebusySchema,
  getConnectionFreebusy,
  getCalendarEventByUidSchema,
  getCalendarEventByUid,
  updateCalendarEventByUidSchema,
  updateCalendarEventByUid,
  deleteCalendarEventSchema,
  deleteCalendarEvent,
  getCalendarEventSchema,
  getCalendarEvent,
  updateCalendarEventSchema,
  updateCalendarEvent,
  listCalendarEventsSchema,
  listCalendarEvents,
  createCalendarEventSchema,
  createCalendarEvent,
  getCalendarFreebusySchema,
  getCalendarFreebusy,
  saveIcsFeedSchema,
  saveIcsFeed,
  checkIcsFeedSchema,
  checkIcsFeed,
  getCalendarConnectUrlSchema,
  getCalendarConnectUrl,
  saveCalendarCredentialsSchema,
  saveCalendarCredentials,
  checkCalendarConnectionSchema,
  checkCalendarConnection,
  disconnectCalendarSchema,
  disconnectCalendar,
} from "./tools/calendars.js";

// ── Webhooks ──
import {
  getWebhooksSchema,
  getWebhooks,
  createWebhookSchema,
  createWebhook,
  deleteWebhookSchema,
  deleteWebhook,
  updateWebhookSchema,
  updateWebhook,
  getWebhookSchema,
  getWebhook,
} from "./tools/webhooks.js";

// ── Users ──
import { getMeSchema, getMe, updateMeSchema, updateMe } from "./tools/users.js";

// ── API Keys ──
import { refreshApiKeySchema, refreshApiKey } from "./tools/api-keys.js";

// ── Conferencing ──
import {
  connectConferencingAppSchema,
  connectConferencingApp,
  getConferencingAuthUrlSchema,
  getConferencingAuthUrl,
  getConferencingAppsSchema,
  getConferencingApps,
  setDefaultConferencingSchema,
  setDefaultConferencing,
  getDefaultConferencingSchema,
  getDefaultConferencing,
  disconnectConferencingAppSchema,
  disconnectConferencingApp,
} from "./tools/conferencing.js";

// ── Destination Calendars ──
import {
  updateDestinationCalendarsSchema,
  updateDestinationCalendars,
} from "./tools/destination-calendars.js";

// ── OAuth ──
import {
  getOauthClientSchema,
  getOauthClient,
  exchangeOauthTokenSchema,
  exchangeOauthToken,
} from "./tools/oauth.js";

// ── Routing Forms ──
import {
  calculateRoutingFormSlotsSchema,
  calculateRoutingFormSlots,
} from "./tools/routing-forms.js";

// ── Selected Calendars ──
import {
  addSelectedCalendarSchema,
  addSelectedCalendar,
  removeSelectedCalendarSchema,
  removeSelectedCalendar,
} from "./tools/selected-calendars.js";

// ── Stripe ──
import {
  getStripeConnectUrlSchema,
  getStripeConnectUrl,
  saveStripeCredentialsSchema,
  saveStripeCredentials,
  checkStripeConnectionSchema,
  checkStripeConnection,
} from "./tools/stripe.js";

// ── Teams ──
import {
  createTeamSchema,
  createTeam,
  getTeamsSchema,
  getTeams,
  getTeamSchema,
  getTeam,
  updateTeamSchema,
  updateTeam,
  deleteTeamSchema,
  deleteTeam,
  getTeamBookingsSchema,
  getTeamBookings,
  createTeamEventTypeSchema,
  createTeamEventType,
  getTeamEventTypesSchema,
  getTeamEventTypes,
  getTeamEventTypeSchema,
  getTeamEventType,
  updateTeamEventTypeSchema,
  updateTeamEventType,
  deleteTeamEventTypeSchema,
  deleteTeamEventType,
  createTeamPhoneCallSchema,
  createTeamPhoneCall,
  createTeamEventTypeWebhookSchema,
  createTeamEventTypeWebhook,
  getTeamEventTypeWebhooksSchema,
  getTeamEventTypeWebhooks,
  deleteAllTeamEventTypeWebhooksSchema,
  deleteAllTeamEventTypeWebhooks,
  updateTeamEventTypeWebhookSchema,
  updateTeamEventTypeWebhook,
  getTeamEventTypeWebhookSchema,
  getTeamEventTypeWebhook,
  deleteTeamEventTypeWebhookSchema,
  deleteTeamEventTypeWebhook,
  createTeamInviteSchema,
  createTeamInvite,
  createTeamMembershipSchema,
  createTeamMembership,
  getTeamMembershipsSchema,
  getTeamMemberships,
  getTeamMembershipSchema,
  getTeamMembership,
  updateTeamMembershipSchema,
  updateTeamMembership,
  deleteTeamMembershipSchema,
  deleteTeamMembership,
  getTeamSchedulesSchema,
  getTeamSchedules,
  requestTeamEmailVerificationSchema,
  requestTeamEmailVerification,
  requestTeamPhoneVerificationSchema,
  requestTeamPhoneVerification,
  verifyTeamEmailSchema,
  verifyTeamEmail,
  verifyTeamPhoneSchema,
  verifyTeamPhone,
  getTeamVerifiedEmailsSchema,
  getTeamVerifiedEmails,
  getTeamVerifiedPhonesSchema,
  getTeamVerifiedPhones,
  getTeamVerifiedEmailSchema,
  getTeamVerifiedEmail,
  getTeamVerifiedPhoneSchema,
  getTeamVerifiedPhone,
} from "./tools/teams.js";

// ── Verified Resources ──
import {
  requestEmailVerificationSchema,
  requestEmailVerification,
  requestPhoneVerificationSchema,
  requestPhoneVerification,
  verifyEmailSchema,
  verifyEmail,
  verifyPhoneSchema,
  verifyPhone,
  getVerifiedEmailsSchema,
  getVerifiedEmails,
  getVerifiedPhonesSchema,
  getVerifiedPhones,
  getVerifiedEmailSchema,
  getVerifiedEmail,
  getVerifiedPhoneSchema,
  getVerifiedPhone,
} from "./tools/verified-resources.js";

// ── Organizations ──
import {
  getOrgAttributesSchema,
  getOrgAttributes,
  createOrgAttributeSchema,
  createOrgAttribute,
  getOrgAttributeSchema,
  getOrgAttribute,
  updateOrgAttributeSchema,
  updateOrgAttribute,
  deleteOrgAttributeSchema,
  deleteOrgAttribute,
  createOrgAttributeOptionSchema,
  createOrgAttributeOption,
  getOrgAttributeOptionsSchema,
  getOrgAttributeOptions,
  deleteOrgAttributeOptionSchema,
  deleteOrgAttributeOption,
  updateOrgAttributeOptionSchema,
  updateOrgAttributeOption,
  getOrgAttributeAssignedOptionsSchema,
  getOrgAttributeAssignedOptions,
  getOrgAttributeOptionsBySlugSchema,
  getOrgAttributeOptionsBySlug,
  assignOrgAttributeToUserSchema,
  assignOrgAttributeToUser,
  getOrgUserAttributeOptionsSchema,
  getOrgUserAttributeOptions,
  unassignOrgAttributeFromUserSchema,
  unassignOrgAttributeFromUser,
  getOrgBookingsSchema,
  getOrgBookings,
  createOrgDelegationCredentialSchema,
  createOrgDelegationCredential,
  updateOrgDelegationCredentialSchema,
  updateOrgDelegationCredential,
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
  createOrgRoleSchema,
  createOrgRole,
  getOrgRolesSchema,
  getOrgRoles,
  getOrgRoleSchema,
  getOrgRole,
  updateOrgRoleSchema,
  updateOrgRole,
  deleteOrgRoleSchema,
  deleteOrgRole,
  addOrgRolePermissionsSchema,
  addOrgRolePermissions,
  getOrgRolePermissionsSchema,
  getOrgRolePermissions,
  replaceOrgRolePermissionsSchema,
  replaceOrgRolePermissions,
  removeOrgRolePermissionsSchema,
  removeOrgRolePermissions,
  removeOrgRolePermissionSchema,
  removeOrgRolePermission,
  getOrgRoutingFormsSchema,
  getOrgRoutingForms,
  getOrgRoutingFormResponsesSchema,
  getOrgRoutingFormResponses,
  createOrgRoutingFormResponseSchema,
  createOrgRoutingFormResponse,
  updateOrgRoutingFormResponseSchema,
  updateOrgRoutingFormResponse,
  getOrgSchedulesSchema,
  getOrgSchedules,
  getOrgTeamsSchema,
  getOrgTeams,
  createOrgTeamSchema,
  createOrgTeam,
  getOrgTeamsMembershipSchema,
  getOrgTeamsMembership,
  getOrgTeamSchema,
  getOrgTeam,
  deleteOrgTeamSchema,
  deleteOrgTeam,
  updateOrgTeamSchema,
  updateOrgTeam,
  getOrgAllTeamEventTypesSchema,
  getOrgAllTeamEventTypes,
  getOrgTeamBookingsSchema,
  getOrgTeamBookings,
  getOrgTeamBookingReferencesSchema,
  getOrgTeamBookingReferences,
  connectOrgTeamConferencingAppSchema,
  connectOrgTeamConferencingApp,
  getOrgTeamConferencingAuthUrlSchema,
  getOrgTeamConferencingAuthUrl,
  getOrgTeamConferencingAppsSchema,
  getOrgTeamConferencingApps,
  setOrgTeamDefaultConferencingSchema,
  setOrgTeamDefaultConferencing,
  getOrgTeamDefaultConferencingSchema,
  getOrgTeamDefaultConferencing,
  disconnectOrgTeamConferencingAppSchema,
  disconnectOrgTeamConferencingApp,
  createOrgTeamEventTypeSchema,
  createOrgTeamEventType,
  getOrgTeamEventTypesSchema,
  getOrgTeamEventTypes,
  getOrgTeamEventTypeSchema,
  getOrgTeamEventType,
  updateOrgTeamEventTypeSchema,
  updateOrgTeamEventType,
  deleteOrgTeamEventTypeSchema,
  deleteOrgTeamEventType,
  createOrgTeamPhoneCallSchema,
  createOrgTeamPhoneCall,
  createOrgTeamEtPrivateLinkSchema,
  createOrgTeamEtPrivateLink,
  getOrgTeamEtPrivateLinksSchema,
  getOrgTeamEtPrivateLinks,
  updateOrgTeamEtPrivateLinkSchema,
  updateOrgTeamEtPrivateLink,
  deleteOrgTeamEtPrivateLinkSchema,
  deleteOrgTeamEtPrivateLink,
  createOrgTeamInviteSchema,
  createOrgTeamInvite,
  getOrgTeamMembershipsSchema,
  getOrgTeamMemberships,
  createOrgTeamMembershipSchema,
  createOrgTeamMembership,
  getOrgTeamMembershipSchema,
  getOrgTeamMembership,
  deleteOrgTeamMembershipSchema,
  deleteOrgTeamMembership,
  updateOrgTeamMembershipSchema,
  updateOrgTeamMembership,
  createOrgTeamRoleSchema,
  createOrgTeamRole,
  getOrgTeamRolesSchema,
  getOrgTeamRoles,
  getOrgTeamRoleSchema,
  getOrgTeamRole,
  updateOrgTeamRoleSchema,
  updateOrgTeamRole,
  deleteOrgTeamRoleSchema,
  deleteOrgTeamRole,
  addOrgTeamRolePermissionsSchema,
  addOrgTeamRolePermissions,
  getOrgTeamRolePermissionsSchema,
  getOrgTeamRolePermissions,
  replaceOrgTeamRolePermissionsSchema,
  replaceOrgTeamRolePermissions,
  removeOrgTeamRolePermissionsSchema,
  removeOrgTeamRolePermissions,
  removeOrgTeamRolePermissionSchema,
  removeOrgTeamRolePermission,
  getOrgTeamRoutingFormsSchema,
  getOrgTeamRoutingForms,
  getOrgTeamRoutingFormResponsesSchema,
  getOrgTeamRoutingFormResponses,
  createOrgTeamRoutingFormResponseSchema,
  createOrgTeamRoutingFormResponse,
  updateOrgTeamRoutingFormResponseSchema,
  updateOrgTeamRoutingFormResponse,
  getOrgTeamSchedulesSchema,
  getOrgTeamSchedules,
  getOrgTeamStripeConnectUrlSchema,
  getOrgTeamStripeConnectUrl,
  checkOrgTeamStripeSchema,
  checkOrgTeamStripe,
  getOrgTeamUserSchedulesSchema,
  getOrgTeamUserSchedules,
  getOrgTeamWorkflowsSchema,
  getOrgTeamWorkflows,
  createOrgTeamWorkflowSchema,
  createOrgTeamWorkflow,
  getOrgTeamRfWorkflowsSchema,
  getOrgTeamRfWorkflows,
  createOrgTeamRfWorkflowSchema,
  createOrgTeamRfWorkflow,
  getOrgTeamWorkflowSchema,
  getOrgTeamWorkflow,
  updateOrgTeamWorkflowSchema,
  updateOrgTeamWorkflow,
  deleteOrgTeamWorkflowSchema,
  deleteOrgTeamWorkflow,
  getOrgTeamRfWorkflowSchema,
  getOrgTeamRfWorkflow,
  updateOrgTeamRfWorkflowSchema,
  updateOrgTeamRfWorkflow,
  deleteOrgTeamRfWorkflowSchema,
  deleteOrgTeamRfWorkflow,
  requestOrgTeamEmailVerificationSchema,
  requestOrgTeamEmailVerification,
  requestOrgTeamPhoneVerificationSchema,
  requestOrgTeamPhoneVerification,
  verifyOrgTeamEmailSchema,
  verifyOrgTeamEmail,
  verifyOrgTeamPhoneSchema,
  verifyOrgTeamPhone,
  getOrgTeamVerifiedEmailsSchema,
  getOrgTeamVerifiedEmails,
  getOrgTeamVerifiedPhonesSchema,
  getOrgTeamVerifiedPhones,
  getOrgTeamVerifiedEmailSchema,
  getOrgTeamVerifiedEmail,
  getOrgTeamVerifiedPhoneSchema,
  getOrgTeamVerifiedPhone,
  getOrgUsersSchema,
  getOrgUsers,
  createOrgUserSchema,
  createOrgUser,
  updateOrgUserSchema,
  updateOrgUser,
  deleteOrgUserSchema,
  deleteOrgUser,
  getOrgUserBookingsSchema,
  getOrgUserBookings,
  getOrgUserOooSchema,
  getOrgUserOoo,
  createOrgUserOooSchema,
  createOrgUserOoo,
  updateOrgUserOooSchema,
  updateOrgUserOoo,
  deleteOrgUserOooSchema,
  deleteOrgUserOoo,
  getOrgOooSchema,
  getOrgOoo,
  createOrgUserScheduleSchema,
  createOrgUserSchedule,
  getOrgUserSchedulesSchema,
  getOrgUserSchedules,
  getOrgUserScheduleSchema,
  getOrgUserSchedule,
  updateOrgUserScheduleSchema,
  updateOrgUserSchedule,
  deleteOrgUserScheduleSchema,
  deleteOrgUserSchedule,
  getOrgWebhooksSchema,
  getOrgWebhooks,
  createOrgWebhookSchema,
  createOrgWebhook,
  getOrgWebhookSchema,
  getOrgWebhook,
  deleteOrgWebhookSchema,
  deleteOrgWebhook,
  updateOrgWebhookSchema,
  updateOrgWebhook,
  createManagedOrgSchema,
  createManagedOrg,
  getManagedOrgsSchema,
  getManagedOrgs,
  getManagedOrgSchema,
  getManagedOrg,
  updateManagedOrgSchema,
  updateManagedOrg,
  deleteManagedOrgSchema,
  deleteManagedOrg,
} from "./tools/organizations/index.js";

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

  // ── Bookings ──
  server.tool("get_bookings", "List bookings with optional filters.", getBookingsSchema, getBookings);
  server.tool("get_booking", "Get a specific booking by UID.", getBookingSchema, getBooking);
  server.tool("create_booking", "Create a new booking.", createBookingSchema, createBooking);
  server.tool("reschedule_booking", "Reschedule a booking.", rescheduleBookingSchema, rescheduleBooking);
  server.tool("cancel_booking", "Cancel a booking.", cancelBookingSchema, cancelBooking);
  server.tool("confirm_booking", "Confirm a pending booking.", confirmBookingSchema, confirmBooking);
  server.tool("get_booking_by_seat", "Get a booking by seat UID.", getBookingBySeatSchema, getBookingBySeat);
  server.tool("get_booking_recordings", "Get all recordings for a booking.", getBookingRecordingsSchema, getBookingRecordings);
  server.tool("get_booking_transcripts", "Get transcript download links for a booking.", getBookingTranscriptsSchema, getBookingTranscripts);
  server.tool("mark_booking_absent", "Mark a booking absence.", markBookingAbsentSchema, markBookingAbsent);
  server.tool("reassign_booking", "Reassign a booking to auto-selected host.", reassignBookingSchema, reassignBooking);
  server.tool("reassign_booking_to_user", "Reassign a booking to a specific host.", reassignBookingToUserSchema, reassignBookingToUser);
  server.tool("decline_booking", "Decline a booking.", declineBookingSchema, declineBooking);
  server.tool("get_booking_calendar_links", "Get 'Add to Calendar' links for a booking.", getBookingCalendarLinksSchema, getBookingCalendarLinks);
  server.tool("get_booking_references", "Get booking references.", getBookingReferencesSchema, getBookingReferences);
  server.tool("get_booking_conferencing_sessions", "Get video meeting sessions for a booking.", getBookingConferencingSessionsSchema, getBookingConferencingSessions);
  server.tool("update_booking_location", "Update booking location.", updateBookingLocationSchema, updateBookingLocation);
  server.tool("get_booking_attendees", "Get all attendees for a booking.", getBookingAttendeesSchema, getBookingAttendees);
  server.tool("add_booking_attendee", "Add an attendee to a booking.", addBookingAttendeeSchema, addBookingAttendee);
  server.tool("get_booking_attendee", "Get a specific attendee for a booking.", getBookingAttendeeSchema, getBookingAttendee);
  server.tool("add_booking_guests", "Add guests to an existing booking.", addBookingGuestsSchema, addBookingGuests);

  // ── Event Types ──
  server.tool("get_event_types", "List all event types.", getEventTypesSchema, getEventTypes);
  server.tool("get_event_type", "Get a specific event type by ID.", getEventTypeSchema, getEventType);
  server.tool("create_event_type", "Create a new event type.", createEventTypeSchema, createEventType);
  server.tool("update_event_type", "Update an event type.", updateEventTypeSchema, updateEventType);
  server.tool("delete_event_type", "Delete an event type.", deleteEventTypeSchema, deleteEventType);
  server.tool("create_event_type_webhook", "Create a webhook for an event type.", createEventTypeWebhookSchema, createEventTypeWebhook);
  server.tool("get_event_type_webhooks", "Get all webhooks for an event type.", getEventTypeWebhooksSchema, getEventTypeWebhooks);
  server.tool("delete_all_event_type_webhooks", "Delete all webhooks for an event type.", deleteAllEventTypeWebhooksSchema, deleteAllEventTypeWebhooks);
  server.tool("update_event_type_webhook", "Update a webhook for an event type.", updateEventTypeWebhookSchema, updateEventTypeWebhook);
  server.tool("get_event_type_webhook", "Get a webhook for an event type.", getEventTypeWebhookSchema, getEventTypeWebhook);
  server.tool("delete_event_type_webhook", "Delete a webhook for an event type.", deleteEventTypeWebhookSchema, deleteEventTypeWebhook);
  server.tool("create_event_type_private_link", "Create a private link for an event type.", createEventTypePrivateLinkSchema, createEventTypePrivateLink);
  server.tool("get_event_type_private_links", "Get all private links for an event type.", getEventTypePrivateLinksSchema, getEventTypePrivateLinks);
  server.tool("update_event_type_private_link", "Update a private link for an event type.", updateEventTypePrivateLinkSchema, updateEventTypePrivateLink);
  server.tool("delete_event_type_private_link", "Delete a private link for an event type.", deleteEventTypePrivateLinkSchema, deleteEventTypePrivateLink);

  // ── Schedules ──
  server.tool("get_schedules", "List all schedules.", getSchedulesSchema, getSchedules);
  server.tool("get_schedule", "Get a specific schedule by ID.", getScheduleSchema, getSchedule);
  server.tool("create_schedule", "Create a new schedule.", createScheduleSchema, createSchedule);
  server.tool("update_schedule", "Update a schedule.", updateScheduleSchema, updateSchedule);
  server.tool("delete_schedule", "Delete a schedule.", deleteScheduleSchema, deleteSchedule);
  server.tool("get_default_schedule", "Get default schedule.", getDefaultScheduleSchema, getDefaultSchedule);

  // ── Availability / Slots ──
  server.tool("get_availability", "Get available time slots (GET /v2/slots). Uses cal-api-version 2024-09-04.", getAvailabilitySchema, getAvailability);
  server.tool("reserve_slot", "Reserve a slot.", reserveSlotSchema, reserveSlot);
  server.tool("get_slot_reservation", "Get a reserved slot.", getSlotReservationSchema, getSlotReservation);
  server.tool("update_slot_reservation", "Update a reserved slot.", updateSlotReservationSchema, updateSlotReservation);
  server.tool("delete_slot_reservation", "Delete a reserved slot.", deleteSlotReservationSchema, deleteSlotReservation);

  // ── Calendars ──
  server.tool("get_calendars", "List connected calendars.", getCalendarsSchema, getCalendars);
  server.tool("get_busy_times", "Get busy times from calendars.", getBusyTimesSchema, getBusyTimes);
  server.tool("get_calendar_connections", "List calendar connections.", getCalendarConnectionsSchema, getCalendarConnections);
  server.tool("get_connection_events", "List events for a connection.", getConnectionEventsSchema, getConnectionEvents);
  server.tool("create_connection_event", "Create event on a connection.", createConnectionEventSchema, createConnectionEvent);
  server.tool("get_connection_event", "Get event for a connection.", getConnectionEventSchema, getConnectionEvent);
  server.tool("update_connection_event", "Update event for a connection.", updateConnectionEventSchema, updateConnectionEvent);
  server.tool("delete_connection_event", "Delete event for a connection.", deleteConnectionEventSchema, deleteConnectionEvent);
  server.tool("get_connection_freebusy", "Get free/busy for a connection.", getConnectionFreebusySchema, getConnectionFreebusy);
  server.tool("get_calendar_event_by_uid", "Get meeting details from calendar.", getCalendarEventByUidSchema, getCalendarEventByUid);
  server.tool("update_calendar_event_by_uid", "Update meeting details in calendar.", updateCalendarEventByUidSchema, updateCalendarEventByUid);
  server.tool("delete_calendar_event", "Delete a calendar event.", deleteCalendarEventSchema, deleteCalendarEvent);
  server.tool("get_calendar_event", "Get meeting details from calendar.", getCalendarEventSchema, getCalendarEvent);
  server.tool("update_calendar_event", "Update meeting details in calendar.", updateCalendarEventSchema, updateCalendarEvent);
  server.tool("list_calendar_events", "List calendar events.", listCalendarEventsSchema, listCalendarEvents);
  server.tool("create_calendar_event", "Create a calendar event.", createCalendarEventSchema, createCalendarEvent);
  server.tool("get_calendar_freebusy", "Get free/busy times.", getCalendarFreebusySchema, getCalendarFreebusy);
  server.tool("save_ics_feed", "Save an ICS feed.", saveIcsFeedSchema, saveIcsFeed);
  server.tool("check_ics_feed", "Check an ICS feed.", checkIcsFeedSchema, checkIcsFeed);
  server.tool("get_calendar_connect_url", "Get OAuth connect URL for a calendar.", getCalendarConnectUrlSchema, getCalendarConnectUrl);
  server.tool("save_calendar_credentials", "Save calendar credentials.", saveCalendarCredentialsSchema, saveCalendarCredentials);
  server.tool("check_calendar_connection", "Check a calendar connection.", checkCalendarConnectionSchema, checkCalendarConnection);
  server.tool("disconnect_calendar", "Disconnect a calendar.", disconnectCalendarSchema, disconnectCalendar);

  // ── Webhooks ──
  server.tool("get_webhooks", "List all webhooks.", getWebhooksSchema, getWebhooks);
  server.tool("create_webhook", "Create a webhook subscription.", createWebhookSchema, createWebhook);
  server.tool("delete_webhook", "Delete a webhook.", deleteWebhookSchema, deleteWebhook);
  server.tool("update_webhook", "Update a webhook.", updateWebhookSchema, updateWebhook);
  server.tool("get_webhook", "Get a specific webhook.", getWebhookSchema, getWebhook);

  // ── User Profile ──
  server.tool("get_me", "Get authenticated user profile.", getMeSchema, getMe);
  server.tool("update_me", "Update user profile.", updateMeSchema, updateMe);

  // ── API Keys ──
  server.tool("refresh_api_key", "Refresh API key.", refreshApiKeySchema, refreshApiKey);

  // ── Conferencing ──
  server.tool("connect_conferencing_app", "Connect a conferencing application.", connectConferencingAppSchema, connectConferencingApp);
  server.tool("get_conferencing_auth_url", "Get OAuth conferencing app auth URL.", getConferencingAuthUrlSchema, getConferencingAuthUrl);
  server.tool("get_conferencing_apps", "List conferencing applications.", getConferencingAppsSchema, getConferencingApps);
  server.tool("set_default_conferencing", "Set default conferencing application.", setDefaultConferencingSchema, setDefaultConferencing);
  server.tool("get_default_conferencing", "Get default conferencing application.", getDefaultConferencingSchema, getDefaultConferencing);
  server.tool("disconnect_conferencing_app", "Disconnect a conferencing application.", disconnectConferencingAppSchema, disconnectConferencingApp);

  // ── Destination Calendars ──
  server.tool("update_destination_calendars", "Update destination calendars.", updateDestinationCalendarsSchema, updateDestinationCalendars);

  // ── OAuth ──
  server.tool("get_oauth_client", "Get OAuth2 client.", getOauthClientSchema, getOauthClient);
  server.tool("exchange_oauth_token", "Exchange authorization code or refresh token for tokens.", exchangeOauthTokenSchema, exchangeOauthToken);

  // ── Routing Forms ──
  server.tool("calculate_routing_form_slots", "Calculate slots based on routing form response.", calculateRoutingFormSlotsSchema, calculateRoutingFormSlots);

  // ── Selected Calendars ──
  server.tool("add_selected_calendar", "Add a selected calendar.", addSelectedCalendarSchema, addSelectedCalendar);
  server.tool("remove_selected_calendar", "Remove a selected calendar.", removeSelectedCalendarSchema, removeSelectedCalendar);

  // ── Stripe ──
  server.tool("get_stripe_connect_url", "Get Stripe connect URL.", getStripeConnectUrlSchema, getStripeConnectUrl);
  server.tool("save_stripe_credentials", "Save Stripe credentials.", saveStripeCredentialsSchema, saveStripeCredentials);
  server.tool("check_stripe_connection", "Check Stripe connection.", checkStripeConnectionSchema, checkStripeConnection);

  // ── Verified Resources ──
  server.tool("request_email_verification", "Request email verification code.", requestEmailVerificationSchema, requestEmailVerification);
  server.tool("request_phone_verification", "Request phone verification code.", requestPhoneVerificationSchema, requestPhoneVerification);
  server.tool("verify_email", "Verify an email.", verifyEmailSchema, verifyEmail);
  server.tool("verify_phone", "Verify a phone number.", verifyPhoneSchema, verifyPhone);
  server.tool("get_verified_emails", "Get list of verified emails.", getVerifiedEmailsSchema, getVerifiedEmails);
  server.tool("get_verified_phones", "Get list of verified phone numbers.", getVerifiedPhonesSchema, getVerifiedPhones);
  server.tool("get_verified_email", "Get verified email by id.", getVerifiedEmailSchema, getVerifiedEmail);
  server.tool("get_verified_phone", "Get verified phone number by id.", getVerifiedPhoneSchema, getVerifiedPhone);

  // ── Teams ──
  server.tool("create_team", "Create a team.", createTeamSchema, createTeam);
  server.tool("get_teams", "Get teams.", getTeamsSchema, getTeams);
  server.tool("get_team", "Get a team.", getTeamSchema, getTeam);
  server.tool("update_team", "Update a team.", updateTeamSchema, updateTeam);
  server.tool("delete_team", "Delete a team.", deleteTeamSchema, deleteTeam);
  server.tool("get_team_bookings", "Get team bookings.", getTeamBookingsSchema, getTeamBookings);
  server.tool("create_team_event_type", "Create a team event type.", createTeamEventTypeSchema, createTeamEventType);
  server.tool("get_team_event_types", "Get team event types.", getTeamEventTypesSchema, getTeamEventTypes);
  server.tool("get_team_event_type", "Get a team event type.", getTeamEventTypeSchema, getTeamEventType);
  server.tool("update_team_event_type", "Update a team event type.", updateTeamEventTypeSchema, updateTeamEventType);
  server.tool("delete_team_event_type", "Delete a team event type.", deleteTeamEventTypeSchema, deleteTeamEventType);
  server.tool("create_team_phone_call", "Create a phone call.", createTeamPhoneCallSchema, createTeamPhoneCall);
  server.tool("create_team_event_type_webhook", "Create a webhook for a team event type.", createTeamEventTypeWebhookSchema, createTeamEventTypeWebhook);
  server.tool("get_team_event_type_webhooks", "Get all webhooks for a team event type.", getTeamEventTypeWebhooksSchema, getTeamEventTypeWebhooks);
  server.tool("delete_all_team_event_type_webhooks", "Delete all webhooks for a team event type.", deleteAllTeamEventTypeWebhooksSchema, deleteAllTeamEventTypeWebhooks);
  server.tool("update_team_event_type_webhook", "Update a webhook for a team event type.", updateTeamEventTypeWebhookSchema, updateTeamEventTypeWebhook);
  server.tool("get_team_event_type_webhook", "Get a webhook for a team event type.", getTeamEventTypeWebhookSchema, getTeamEventTypeWebhook);
  server.tool("delete_team_event_type_webhook", "Delete a webhook for a team event type.", deleteTeamEventTypeWebhookSchema, deleteTeamEventTypeWebhook);
  server.tool("create_team_invite", "Create team invite link.", createTeamInviteSchema, createTeamInvite);
  server.tool("create_team_membership", "Create a team membership.", createTeamMembershipSchema, createTeamMembership);
  server.tool("get_team_memberships", "Get all team memberships.", getTeamMembershipsSchema, getTeamMemberships);
  server.tool("get_team_membership", "Get a team membership.", getTeamMembershipSchema, getTeamMembership);
  server.tool("update_team_membership", "Update a team membership.", updateTeamMembershipSchema, updateTeamMembership);
  server.tool("delete_team_membership", "Delete a team membership.", deleteTeamMembershipSchema, deleteTeamMembership);
  server.tool("get_team_schedules", "Get all team member schedules.", getTeamSchedulesSchema, getTeamSchedules);
  server.tool("request_team_email_verification", "Request team email verification code.", requestTeamEmailVerificationSchema, requestTeamEmailVerification);
  server.tool("request_team_phone_verification", "Request team phone verification code.", requestTeamPhoneVerificationSchema, requestTeamPhoneVerification);
  server.tool("verify_team_email", "Verify an email for a team.", verifyTeamEmailSchema, verifyTeamEmail);
  server.tool("verify_team_phone", "Verify a phone for a team.", verifyTeamPhoneSchema, verifyTeamPhone);
  server.tool("get_team_verified_emails", "Get verified emails of a team.", getTeamVerifiedEmailsSchema, getTeamVerifiedEmails);
  server.tool("get_team_verified_phones", "Get verified phone numbers of a team.", getTeamVerifiedPhonesSchema, getTeamVerifiedPhones);
  server.tool("get_team_verified_email", "Get verified email of a team by id.", getTeamVerifiedEmailSchema, getTeamVerifiedEmail);
  server.tool("get_team_verified_phone", "Get verified phone number of a team by id.", getTeamVerifiedPhoneSchema, getTeamVerifiedPhone);

  // ── Organizations: Attributes ──
  server.tool("get_org_attributes", "Get all organization attributes.", getOrgAttributesSchema, getOrgAttributes);
  server.tool("create_org_attribute", "Create an organization attribute.", createOrgAttributeSchema, createOrgAttribute);
  server.tool("get_org_attribute", "Get an organization attribute.", getOrgAttributeSchema, getOrgAttribute);
  server.tool("update_org_attribute", "Update an organization attribute.", updateOrgAttributeSchema, updateOrgAttribute);
  server.tool("delete_org_attribute", "Delete an organization attribute.", deleteOrgAttributeSchema, deleteOrgAttribute);
  server.tool("create_org_attribute_option", "Create an attribute option.", createOrgAttributeOptionSchema, createOrgAttributeOption);
  server.tool("get_org_attribute_options", "Get all attribute options.", getOrgAttributeOptionsSchema, getOrgAttributeOptions);
  server.tool("delete_org_attribute_option", "Delete an attribute option.", deleteOrgAttributeOptionSchema, deleteOrgAttributeOption);
  server.tool("update_org_attribute_option", "Update an attribute option.", updateOrgAttributeOptionSchema, updateOrgAttributeOption);
  server.tool("get_org_attribute_assigned_options", "Get assigned attribute options by ID.", getOrgAttributeAssignedOptionsSchema, getOrgAttributeAssignedOptions);
  server.tool("get_org_attribute_options_by_slug", "Get assigned attribute options by slug.", getOrgAttributeOptionsBySlugSchema, getOrgAttributeOptionsBySlug);
  server.tool("assign_org_attribute_to_user", "Assign an attribute to a user.", assignOrgAttributeToUserSchema, assignOrgAttributeToUser);
  server.tool("get_org_user_attribute_options", "Get all attribute options for a user.", getOrgUserAttributeOptionsSchema, getOrgUserAttributeOptions);
  server.tool("unassign_org_attribute_from_user", "Unassign an attribute from a user.", unassignOrgAttributeFromUserSchema, unassignOrgAttributeFromUser);

  // ── Organizations: Bookings ──
  server.tool("get_org_bookings", "Get organization bookings.", getOrgBookingsSchema, getOrgBookings);

  // ── Organizations: Delegation Credentials ──
  server.tool("create_org_delegation_credential", "Save delegation credentials.", createOrgDelegationCredentialSchema, createOrgDelegationCredential);
  server.tool("update_org_delegation_credential", "Update delegation credentials.", updateOrgDelegationCredentialSchema, updateOrgDelegationCredential);

  // ── Organizations: Memberships ──
  server.tool("get_org_memberships", "Get all organization memberships.", getOrgMembershipsSchema, getOrgMemberships);
  server.tool("create_org_membership", "Create an organization membership.", createOrgMembershipSchema, createOrgMembership);
  server.tool("get_org_membership", "Get an organization membership.", getOrgMembershipSchema, getOrgMembership);
  server.tool("delete_org_membership", "Delete an organization membership.", deleteOrgMembershipSchema, deleteOrgMembership);
  server.tool("update_org_membership", "Update an organization membership.", updateOrgMembershipSchema, updateOrgMembership);

  // ── Organizations: Roles ──
  server.tool("create_org_role", "Create a new organization role.", createOrgRoleSchema, createOrgRole);
  server.tool("get_org_roles", "Get all organization roles.", getOrgRolesSchema, getOrgRoles);
  server.tool("get_org_role", "Get a specific organization role.", getOrgRoleSchema, getOrgRole);
  server.tool("update_org_role", "Update an organization role.", updateOrgRoleSchema, updateOrgRole);
  server.tool("delete_org_role", "Delete an organization role.", deleteOrgRoleSchema, deleteOrgRole);
  server.tool("add_org_role_permissions", "Add permissions to an organization role.", addOrgRolePermissionsSchema, addOrgRolePermissions);
  server.tool("get_org_role_permissions", "List permissions for an organization role.", getOrgRolePermissionsSchema, getOrgRolePermissions);
  server.tool("replace_org_role_permissions", "Replace all permissions for an organization role.", replaceOrgRolePermissionsSchema, replaceOrgRolePermissions);
  server.tool("remove_org_role_permissions", "Remove multiple permissions from an organization role.", removeOrgRolePermissionsSchema, removeOrgRolePermissions);
  server.tool("remove_org_role_permission", "Remove a permission from an organization role.", removeOrgRolePermissionSchema, removeOrgRolePermission);

  // ── Organizations: Routing Forms ──
  server.tool("get_org_routing_forms", "Get organization routing forms.", getOrgRoutingFormsSchema, getOrgRoutingForms);
  server.tool("get_org_routing_form_responses", "Get routing form responses.", getOrgRoutingFormResponsesSchema, getOrgRoutingFormResponses);
  server.tool("create_org_routing_form_response", "Create routing form response.", createOrgRoutingFormResponseSchema, createOrgRoutingFormResponse);
  server.tool("update_org_routing_form_response", "Update routing form response.", updateOrgRoutingFormResponseSchema, updateOrgRoutingFormResponse);

  // ── Organizations: Schedules ──
  server.tool("get_org_schedules", "Get all organization schedules.", getOrgSchedulesSchema, getOrgSchedules);

  // ── Organizations: Teams ──
  server.tool("get_org_teams", "Get all organization teams.", getOrgTeamsSchema, getOrgTeams);
  server.tool("create_org_team", "Create an organization team.", createOrgTeamSchema, createOrgTeam);
  server.tool("get_org_teams_membership", "Get teams membership for user.", getOrgTeamsMembershipSchema, getOrgTeamsMembership);
  server.tool("get_org_all_team_event_types", "Get all organization team event types.", getOrgAllTeamEventTypesSchema, getOrgAllTeamEventTypes);
  server.tool("get_org_team", "Get an organization team.", getOrgTeamSchema, getOrgTeam);
  server.tool("delete_org_team", "Delete an organization team.", deleteOrgTeamSchema, deleteOrgTeam);
  server.tool("update_org_team", "Update an organization team.", updateOrgTeamSchema, updateOrgTeam);

  // ── Organizations: Team Bookings ──
  server.tool("get_org_team_bookings", "Get organization team bookings.", getOrgTeamBookingsSchema, getOrgTeamBookings);
  server.tool("get_org_team_booking_references", "Get booking references.", getOrgTeamBookingReferencesSchema, getOrgTeamBookingReferences);

  // ── Organizations: Team Conferencing ──
  server.tool("connect_org_team_conferencing_app", "Connect conferencing app to a team.", connectOrgTeamConferencingAppSchema, connectOrgTeamConferencingApp);
  server.tool("get_org_team_conferencing_auth_url", "Get conferencing auth URL for a team.", getOrgTeamConferencingAuthUrlSchema, getOrgTeamConferencingAuthUrl);
  server.tool("get_org_team_conferencing_apps", "List team conferencing applications.", getOrgTeamConferencingAppsSchema, getOrgTeamConferencingApps);
  server.tool("set_org_team_default_conferencing", "Set team default conferencing app.", setOrgTeamDefaultConferencingSchema, setOrgTeamDefaultConferencing);
  server.tool("get_org_team_default_conferencing", "Get team default conferencing app.", getOrgTeamDefaultConferencingSchema, getOrgTeamDefaultConferencing);
  server.tool("disconnect_org_team_conferencing_app", "Disconnect team conferencing app.", disconnectOrgTeamConferencingAppSchema, disconnectOrgTeamConferencingApp);

  // ── Organizations: Team Event Types ──
  server.tool("create_org_team_event_type", "Create a team event type.", createOrgTeamEventTypeSchema, createOrgTeamEventType);
  server.tool("get_org_team_event_types", "Get team event types.", getOrgTeamEventTypesSchema, getOrgTeamEventTypes);
  server.tool("get_org_team_event_type", "Get a team event type.", getOrgTeamEventTypeSchema, getOrgTeamEventType);
  server.tool("update_org_team_event_type", "Update a team event type.", updateOrgTeamEventTypeSchema, updateOrgTeamEventType);
  server.tool("delete_org_team_event_type", "Delete a team event type.", deleteOrgTeamEventTypeSchema, deleteOrgTeamEventType);
  server.tool("create_org_team_phone_call", "Create a phone call.", createOrgTeamPhoneCallSchema, createOrgTeamPhoneCall);
  server.tool("create_org_team_et_private_link", "Create a private link for a team event type.", createOrgTeamEtPrivateLinkSchema, createOrgTeamEtPrivateLink);
  server.tool("get_org_team_et_private_links", "Get all private links for a team event type.", getOrgTeamEtPrivateLinksSchema, getOrgTeamEtPrivateLinks);
  server.tool("update_org_team_et_private_link", "Update a private link for a team event type.", updateOrgTeamEtPrivateLinkSchema, updateOrgTeamEtPrivateLink);
  server.tool("delete_org_team_et_private_link", "Delete a private link for a team event type.", deleteOrgTeamEtPrivateLinkSchema, deleteOrgTeamEtPrivateLink);

  // ── Organizations: Team Invite ──
  server.tool("create_org_team_invite", "Create team invite link.", createOrgTeamInviteSchema, createOrgTeamInvite);

  // ── Organizations: Team Memberships ──
  server.tool("get_org_team_memberships", "Get all team memberships.", getOrgTeamMembershipsSchema, getOrgTeamMemberships);
  server.tool("create_org_team_membership", "Create a team membership.", createOrgTeamMembershipSchema, createOrgTeamMembership);
  server.tool("get_org_team_membership", "Get a team membership.", getOrgTeamMembershipSchema, getOrgTeamMembership);
  server.tool("delete_org_team_membership", "Delete a team membership.", deleteOrgTeamMembershipSchema, deleteOrgTeamMembership);
  server.tool("update_org_team_membership", "Update a team membership.", updateOrgTeamMembershipSchema, updateOrgTeamMembership);

  // ── Organizations: Team Roles ──
  server.tool("create_org_team_role", "Create a new team role.", createOrgTeamRoleSchema, createOrgTeamRole);
  server.tool("get_org_team_roles", "Get all team roles.", getOrgTeamRolesSchema, getOrgTeamRoles);
  server.tool("get_org_team_role", "Get a specific team role.", getOrgTeamRoleSchema, getOrgTeamRole);
  server.tool("update_org_team_role", "Update a team role.", updateOrgTeamRoleSchema, updateOrgTeamRole);
  server.tool("delete_org_team_role", "Delete a team role.", deleteOrgTeamRoleSchema, deleteOrgTeamRole);
  server.tool("add_org_team_role_permissions", "Add permissions to a team role.", addOrgTeamRolePermissionsSchema, addOrgTeamRolePermissions);
  server.tool("get_org_team_role_permissions", "List permissions for a team role.", getOrgTeamRolePermissionsSchema, getOrgTeamRolePermissions);
  server.tool("replace_org_team_role_permissions", "Replace all permissions for a team role.", replaceOrgTeamRolePermissionsSchema, replaceOrgTeamRolePermissions);
  server.tool("remove_org_team_role_permissions", "Remove multiple permissions from a team role.", removeOrgTeamRolePermissionsSchema, removeOrgTeamRolePermissions);
  server.tool("remove_org_team_role_permission", "Remove a permission from a team role.", removeOrgTeamRolePermissionSchema, removeOrgTeamRolePermission);

  // ── Organizations: Team Routing Forms ──
  server.tool("get_org_team_routing_forms", "Get team routing forms.", getOrgTeamRoutingFormsSchema, getOrgTeamRoutingForms);
  server.tool("get_org_team_routing_form_responses", "Get team routing form responses.", getOrgTeamRoutingFormResponsesSchema, getOrgTeamRoutingFormResponses);
  server.tool("create_org_team_routing_form_response", "Create team routing form response.", createOrgTeamRoutingFormResponseSchema, createOrgTeamRoutingFormResponse);
  server.tool("update_org_team_routing_form_response", "Update team routing form response.", updateOrgTeamRoutingFormResponseSchema, updateOrgTeamRoutingFormResponse);

  // ── Organizations: Team Schedules ──
  server.tool("get_org_team_schedules", "Get all team member schedules.", getOrgTeamSchedulesSchema, getOrgTeamSchedules);
  server.tool("get_org_team_user_schedules", "Get schedules of a team member.", getOrgTeamUserSchedulesSchema, getOrgTeamUserSchedules);

  // ── Organizations: Team Stripe ──
  server.tool("get_org_team_stripe_connect_url", "Get Stripe connect URL for a team.", getOrgTeamStripeConnectUrlSchema, getOrgTeamStripeConnectUrl);
  server.tool("check_org_team_stripe", "Check team Stripe connection.", checkOrgTeamStripeSchema, checkOrgTeamStripe);

  // ── Organizations: Team Verified Resources ──
  server.tool("request_org_team_email_verification", "Request org team email verification.", requestOrgTeamEmailVerificationSchema, requestOrgTeamEmailVerification);
  server.tool("request_org_team_phone_verification", "Request org team phone verification.", requestOrgTeamPhoneVerificationSchema, requestOrgTeamPhoneVerification);
  server.tool("verify_org_team_email", "Verify an email for an org team.", verifyOrgTeamEmailSchema, verifyOrgTeamEmail);
  server.tool("verify_org_team_phone", "Verify a phone for an org team.", verifyOrgTeamPhoneSchema, verifyOrgTeamPhone);
  server.tool("get_org_team_verified_emails", "Get verified emails of an org team.", getOrgTeamVerifiedEmailsSchema, getOrgTeamVerifiedEmails);
  server.tool("get_org_team_verified_phones", "Get verified phone numbers of an org team.", getOrgTeamVerifiedPhonesSchema, getOrgTeamVerifiedPhones);
  server.tool("get_org_team_verified_email", "Get verified email of an org team by id.", getOrgTeamVerifiedEmailSchema, getOrgTeamVerifiedEmail);
  server.tool("get_org_team_verified_phone", "Get verified phone of an org team by id.", getOrgTeamVerifiedPhoneSchema, getOrgTeamVerifiedPhone);

  // ── Organizations: Team Workflows ──
  server.tool("get_org_team_workflows", "Get organization team workflows.", getOrgTeamWorkflowsSchema, getOrgTeamWorkflows);
  server.tool("create_org_team_workflow", "Create organization team workflow.", createOrgTeamWorkflowSchema, createOrgTeamWorkflow);
  server.tool("get_org_team_rf_workflows", "Get org team routing form workflows.", getOrgTeamRfWorkflowsSchema, getOrgTeamRfWorkflows);
  server.tool("create_org_team_rf_workflow", "Create org team routing form workflow.", createOrgTeamRfWorkflowSchema, createOrgTeamRfWorkflow);
  server.tool("get_org_team_workflow", "Get organization team workflow.", getOrgTeamWorkflowSchema, getOrgTeamWorkflow);
  server.tool("update_org_team_workflow", "Update organization team workflow.", updateOrgTeamWorkflowSchema, updateOrgTeamWorkflow);
  server.tool("delete_org_team_workflow", "Delete organization team workflow.", deleteOrgTeamWorkflowSchema, deleteOrgTeamWorkflow);
  server.tool("get_org_team_rf_workflow", "Get org team routing form workflow.", getOrgTeamRfWorkflowSchema, getOrgTeamRfWorkflow);
  server.tool("update_org_team_rf_workflow", "Update org team routing form workflow.", updateOrgTeamRfWorkflowSchema, updateOrgTeamRfWorkflow);
  server.tool("delete_org_team_rf_workflow", "Delete org team routing form workflow.", deleteOrgTeamRfWorkflowSchema, deleteOrgTeamRfWorkflow);

  // ── Organizations: Users ──
  server.tool("get_org_users", "Get all organization users.", getOrgUsersSchema, getOrgUsers);
  server.tool("create_org_user", "Create an organization user.", createOrgUserSchema, createOrgUser);
  server.tool("update_org_user", "Update an organization user.", updateOrgUserSchema, updateOrgUser);
  server.tool("delete_org_user", "Delete an organization user.", deleteOrgUserSchema, deleteOrgUser);

  // ── Organizations: User Bookings ──
  server.tool("get_org_user_bookings", "Get bookings for an organization user.", getOrgUserBookingsSchema, getOrgUserBookings);

  // ── Organizations: User Out-of-Office ──
  server.tool("get_org_ooo", "Get all out-of-office entries for organization.", getOrgOooSchema, getOrgOoo);
  server.tool("get_org_user_ooo", "Get out-of-office entries for a user.", getOrgUserOooSchema, getOrgUserOoo);
  server.tool("create_org_user_ooo", "Create an out-of-office entry.", createOrgUserOooSchema, createOrgUserOoo);
  server.tool("update_org_user_ooo", "Update an out-of-office entry.", updateOrgUserOooSchema, updateOrgUserOoo);
  server.tool("delete_org_user_ooo", "Delete an out-of-office entry.", deleteOrgUserOooSchema, deleteOrgUserOoo);

  // ── Organizations: User Schedules ──
  server.tool("create_org_user_schedule", "Create a user schedule.", createOrgUserScheduleSchema, createOrgUserSchedule);
  server.tool("get_org_user_schedules", "Get all user schedules.", getOrgUserSchedulesSchema, getOrgUserSchedules);
  server.tool("get_org_user_schedule", "Get a user schedule.", getOrgUserScheduleSchema, getOrgUserSchedule);
  server.tool("update_org_user_schedule", "Update a user schedule.", updateOrgUserScheduleSchema, updateOrgUserSchedule);
  server.tool("delete_org_user_schedule", "Delete a user schedule.", deleteOrgUserScheduleSchema, deleteOrgUserSchedule);

  // ── Organizations: Webhooks ──
  server.tool("get_org_webhooks", "Get all organization webhooks.", getOrgWebhooksSchema, getOrgWebhooks);
  server.tool("create_org_webhook", "Create an organization webhook.", createOrgWebhookSchema, createOrgWebhook);
  server.tool("get_org_webhook", "Get an organization webhook.", getOrgWebhookSchema, getOrgWebhook);
  server.tool("delete_org_webhook", "Delete an organization webhook.", deleteOrgWebhookSchema, deleteOrgWebhook);
  server.tool("update_org_webhook", "Update an organization webhook.", updateOrgWebhookSchema, updateOrgWebhook);

  // ── Organizations: Managed Organizations ──
  server.tool("create_managed_org", "Create a managed organization.", createManagedOrgSchema, createManagedOrg);
  server.tool("get_managed_orgs", "Get all managed organizations.", getManagedOrgsSchema, getManagedOrgs);
  server.tool("get_managed_org", "Get a managed organization.", getManagedOrgSchema, getManagedOrg);
  server.tool("update_managed_org", "Update a managed organization.", updateManagedOrgSchema, updateManagedOrg);
  server.tool("delete_managed_org", "Delete a managed organization.", deleteManagedOrgSchema, deleteManagedOrg);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[mcp-server] Cal.com MCP server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-server] Fatal error:", err);
  process.exit(1);
});
