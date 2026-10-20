/**
 * Cal.com API Service
 *
 * This module provides a unified interface for interacting with the Cal.com API v2.
 * It is organized into logical submodules for better maintainability:
 *
 * - auth: Authentication configuration and token management
 * - bookings: Booking CRUD operations and actions
 * - conferencing: Conferencing options
 * - event-types: Event type CRUD operations
 * - private-links: Private link management for event types
 * - request: Core HTTP request functionality
 * - schedules: Schedule CRUD operations
 * - user: User profile management
 * - utils: JSON parsing and payload sanitization utilities
 * - webhooks: Webhook management (global and event type specific)
 */

// Re-export types for backward compatibility
export type {
  AddCalEventLocationInput,
  ApproveAllCalEventRegistrationsInput,
  Booking,
  BookingLimitsCount,
  BookingLimitsDuration,
  BookingParticipationResult,
  CalEvent,
  CalEventApproveAllResult,
  CalEventBackground,
  CalEventCategory,
  CalEventCheckInList,
  CalEventCheckInResult,
  CalEventCoHost,
  CalEventCustomFieldType,
  CalEventGuest,
  CalEventGuestList,
  CalEventHost,
  CalEventInvitationReason,
  CalEventInvitationResult,
  CalEventLineup,
  CalEventLineupPerson,
  CalEventLocation,
  CalEventMessage,
  CalEventMessageSegment,
  CalEventMessageSendResult,
  CalEventMessageStatus,
  CalEventMessagesPage,
  CalEventRegistrationCounts,
  CalEventRegistrationDecision,
  CalEventRegistrationField,
  CalEventRegistrationStatus,
  CalEventRosterGuest,
  CalEventRsvpResponse,
  CalEventScheduleItem,
  CalEventSchedulePerson,
  CalEventShaderId,
  CalEventStatus,
  CalEventsListingStatus,
  CalEventsPage,
  CalEventTheme,
  CalEventTicketCheckInResult,
  ConferencingOption,
  ConfirmationPolicy,
  CreateCalEventInput,
  CreateEventTypeInput,
  CreatePrivateLinkInput,
  CreateWebhookInput,
  EventType,
  InviteCalEventGuestsInput,
  PrivateLink,
  Schedule,
  SendCalEventMessageInput,
  Team,
  UpdateCalEventInput,
  UpdateCalEventLocationInput,
  UpdatePrivateLinkInput,
  UpdateWebhookInput,
  UserProfile,
  Webhook,
} from "../types";

// Import all functions from submodules
import {
  beginAuthGeneration,
  clearAuth,
  clearAuthCallbacks,
  getAuthGeneration,
  invalidateAuthSession,
  runAuthTransition,
  setAccessToken,
  setAuthFailureCallback,
  setRefreshTokenFunction,
  setTokenRefreshCallback,
} from "./auth";
import {
  addGuests,
  cancelBooking,
  confirmBooking,
  declineBooking,
  getBookingByUid,
  getBookingParticipation,
  getBookings,
  getConferencingSessions,
  getRecordings,
  getTranscripts,
  markAbsent,
  rescheduleBooking,
  updateLocation,
  updateLocationV2,
} from "./bookings";
import {
  addCalEventLocation,
  approveAllCalEventRegistrations,
  approveCalEventRegistration,
  cancelCalEvent,
  checkInCalEventGuest,
  checkInCalEventGuestByTicket,
  createCalEvent,
  declineCalEventRegistration,
  deleteCalEvent,
  deleteCalEventCoverImage,
  getCalEvent,
  getCalEventCoHosts,
  getCalEventGuests,
  getCalEventLocations,
  getCalEventMessages,
  getCalEventRegistrationCounts,
  getCalEventRoster,
  getCalEvents,
  inviteCalEventCoHost,
  inviteCalEventGuests,
  publishCalEvent,
  removeCalEventCoHost,
  removeCalEventLocation,
  reorderCalEventCoHosts,
  sendCalEventMessage,
  undoCalEventGuestCheckIn,
  updateCalEvent,
  updateCalEventLocation,
  uploadCalEventCoverImage,
  uploadCalEventPersonAvatar,
} from "./cal-events";

export type { CalEventImageFile } from "./cal-events";

import { getConferencingOptions } from "./conferencing";
import {
  createEventType,
  deleteEventType,
  getEventTypeById,
  getEventTypes,
  updateEventType,
} from "./event-types";
import { registerAppPushSubscription, removeAppPushSubscription } from "./notifications";
import {
  createEventTypePrivateLink,
  deleteEventTypePrivateLink,
  getEventTypePrivateLinks,
  updateEventTypePrivateLink,
} from "./private-links";
import { testRawBookingsAPI } from "./request";
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  getScheduleById,
  getSchedules,
  updateSchedule,
} from "./schedules";
import { getTeamMembers, getTeams } from "./teams";

export type { TeamMember } from "./teams";

import {
  clearUserProfile,
  getCurrentUser,
  getUsername,
  getUserProfile,
  updateUserProfile,
} from "./user";
import {
  createEventTypeWebhook,
  createWebhook,
  deleteEventTypeWebhook,
  deleteWebhook,
  getEventTypeWebhooks,
  getWebhooks,
  updateEventTypeWebhook,
  updateWebhook,
} from "./webhooks";

// Re-export the booking participation helper for direct use
export { getBookingParticipation };

// Export the unified CalComAPIService object for backward compatibility
export const CalComAPIService = {
  // Auth
  setAccessToken,
  setRefreshTokenFunction,
  clearAuth,
  clearAuthCallbacks,
  setTokenRefreshCallback,
  setAuthFailureCallback,
  beginAuthGeneration,
  getAuthGeneration,
  invalidateAuthSession,
  runAuthTransition,

  // User
  getCurrentUser,
  updateUserProfile,
  getUserProfile,
  getUsername,
  clearUserProfile,

  // Debug
  testRawBookingsAPI,

  // Event Types
  deleteEventType,
  createEventType,
  getEventTypes,
  getEventTypeById,
  updateEventType,

  // Cal Events
  getCalEvents,
  getCalEvent,
  createCalEvent,
  publishCalEvent,
  cancelCalEvent,
  deleteCalEvent,
  updateCalEvent,
  getCalEventLocations,
  addCalEventLocation,
  updateCalEventLocation,
  removeCalEventLocation,
  uploadCalEventCoverImage,
  deleteCalEventCoverImage,
  uploadCalEventPersonAvatar,
  getCalEventCoHosts,
  inviteCalEventCoHost,
  reorderCalEventCoHosts,
  removeCalEventCoHost,
  getCalEventRoster,
  getCalEventRegistrationCounts,
  inviteCalEventGuests,
  sendCalEventMessage,
  getCalEventMessages,
  approveAllCalEventRegistrations,
  approveCalEventRegistration,
  declineCalEventRegistration,
  getCalEventGuests,
  checkInCalEventGuest,
  checkInCalEventGuestByTicket,
  undoCalEventGuestCheckIn,

  // Teams
  getTeams,
  getTeamMembers,

  // Bookings
  cancelBooking,
  rescheduleBooking,
  confirmBooking,
  declineBooking,
  markAbsent,
  addGuests,
  updateLocation,
  updateLocationV2,
  getRecordings,
  getConferencingSessions,
  getTranscripts,
  getBookingByUid,
  getBookings,

  // Schedules
  getSchedules,
  createSchedule,
  getScheduleById,
  updateSchedule,
  duplicateSchedule,
  deleteSchedule,

  // Conferencing
  getConferencingOptions,

  // Webhooks
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getEventTypeWebhooks,
  createEventTypeWebhook,
  updateEventTypeWebhook,
  deleteEventTypeWebhook,

  // Private Links
  getEventTypePrivateLinks,
  createEventTypePrivateLink,
  updateEventTypePrivateLink,
  deleteEventTypePrivateLink,

  // Notifications
  registerAppPushSubscription,
  removeAppPushSubscription,
};
