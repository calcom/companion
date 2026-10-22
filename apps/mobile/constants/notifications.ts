/**
 * Push-notification category and action identifiers.
 *
 * The Cal.com backend sets `categoryId` to {@link BOOKING_REQUEST_CATEGORY_ID}
 * on booking-request push payloads. Expo/the OS then renders the Confirm and
 * Decline action buttons defined for that category, and the response handler in
 * `PushNotificationProvider` dispatches on the action identifiers below.
 *
 * Identifiers intentionally avoid `:` and `-`: the dedupe scheme keys handled
 * responses by `${notificationId}:${actionIdentifier}`, so a `:` in an action
 * id would corrupt that key.
 */
export const BOOKING_REQUEST_CATEGORY_ID = "calcom_booking_request_actions";
export const CONFIRM_BOOKING_REQUEST_ACTION_ID = "confirm_booking_request";
export const DECLINE_BOOKING_REQUEST_ACTION_ID = "decline_booking_request";

/**
 * Booking notification events the Cal.com backend can put in the push payload's
 * `data.notificationEvent`. Mirrors the `NotificationEvent` enum in
 * calcom/cal (packages/features/notifications) — keep in sync when it grows.
 */
export const NOTIFICATION_EVENTS = [
  "BOOKING_REQUESTED",
  "BOOKING_REQUEST_REMINDER",
  "BOOKING_CONFIRMED",
  "BOOKING_REJECTED",
  "BOOKING_RESCHEDULED",
  "BOOKING_RESCHEDULE_REQUESTED",
  "BOOKING_CANCELLED",
  "BOOKING_LOCATION_CHANGED",
  "BOOKING_REASSIGNED",
  "BOOKING_ATTENDEE_ADDED",
  "BOOKING_GUESTS_ADDED",
  "BOOKING_SEAT_CANCELLED",
  "PAYMENT_RECEIVED",
  "BOOKING_PROPOSAL_REQUESTED",
  "RECORDING_READY",
  "TRANSCRIPT_READY",
  "CAL_EVENT_NEW_REGISTRATION",
  "CAL_EVENT_PENDING_REGISTRATION",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
