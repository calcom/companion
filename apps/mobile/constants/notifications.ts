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
