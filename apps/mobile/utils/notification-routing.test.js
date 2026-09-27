import { describe, expect, test } from "@jest/globals";
import { NOTIFICATION_EVENTS } from "@/constants/notifications";
import { parseNotificationEvent, resolveNotificationRoute } from "@/utils/notification-routing";

describe("resolveNotificationRoute", () => {
  test("routes to booking detail when bookingUid is in the payload", () => {
    expect(
      resolveNotificationRoute({
        bookingUid: "abc123",
        notificationEvent: "BOOKING_CANCELLED",
      })
    ).toBe("/(tabs)/(bookings)/booking-detail?uid=abc123&source=notification");
  });

  test("falls back to the uid query param on the deep link", () => {
    expect(
      resolveNotificationRoute({
        url: "calcom://(tabs)/(bookings)/booking-detail?uid=xyz789",
        notificationEvent: "BOOKING_CONFIRMED",
      })
    ).toBe("/(tabs)/(bookings)/booking-detail?uid=xyz789&source=notification");
  });

  test("routes the bookings list deep link", () => {
    expect(
      resolveNotificationRoute({
        url: "calcom://(tabs)/(bookings)",
      })
    ).toBe("/(tabs)/(bookings)");
  });

  test("routes an allowlisted tab group and preserves its query", () => {
    expect(
      resolveNotificationRoute({
        url: "calcom://(tabs)/(availability)?day=monday",
      })
    ).toBe("/(tabs)/(availability)?day=monday");
  });

  test("falls back to the bookings list for a non-allowlisted path with a known event", () => {
    expect(
      resolveNotificationRoute({
        url: "calcom://(tabs)/(events)/event-detail?uuid=x",
        notificationEvent: "CAL_EVENT_NEW_REGISTRATION",
      })
    ).toBe("/(tabs)/(bookings)");
  });

  test("returns null for an unknown event with no url", () => {
    expect(resolveNotificationRoute({ notificationEvent: "SOMETHING_ELSE" })).toBeNull();
  });

  test("routes to the bookings list for a malformed url with a known event", () => {
    expect(
      resolveNotificationRoute({
        url: ":::not-a-url:::",
        notificationEvent: "RECORDING_READY",
      })
    ).toBe("/(tabs)/(bookings)");
  });

  test("returns null for undefined data", () => {
    expect(resolveNotificationRoute(undefined)).toBeNull();
    expect(resolveNotificationRoute({})).toBeNull();
  });
});

describe("parseNotificationEvent", () => {
  test("accepts every NotificationEvent value", () => {
    for (const event of NOTIFICATION_EVENTS) {
      expect(parseNotificationEvent(event)).toBe(event);
    }
    expect(NOTIFICATION_EVENTS).toHaveLength(18);
  });

  test("rejects non-event values", () => {
    expect(parseNotificationEvent("FOO")).toBeNull();
    expect(parseNotificationEvent(123)).toBeNull();
    expect(parseNotificationEvent(null)).toBeNull();
    expect(parseNotificationEvent(undefined)).toBeNull();
  });
});
