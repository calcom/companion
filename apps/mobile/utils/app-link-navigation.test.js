import { describe, expect, test } from "@jest/globals";
import { getNativeRouteFromAppLink } from "@/utils/app-link-navigation";

describe("getNativeRouteFromAppLink", () => {
  test.each([
    ["https://app.cal.com/bookings", "/(tabs)/(bookings)?source=app-link"],
    [
      "https://app.cal.com/bookings/unconfirmed",
      "/(tabs)/(bookings)?filter=unconfirmed&source=app-link",
    ],
    [
      "https://app.cal.com/bookings/recurring",
      "/(tabs)/(bookings)?filter=recurring&source=app-link",
    ],
    [
      "https://app.cal.com/bookings/cancelled",
      "/(tabs)/(bookings)?filter=cancelled&source=app-link",
    ],
    [
      "https://app.cal.com/bookings/upcoming?uid=booking-uid",
      "/(tabs)/(bookings)/booking-detail?uid=booking-uid&source=app-link",
    ],
    [
      "https://app.cal.com/booking/booking-uid",
      "/(tabs)/(bookings)/booking-detail?uid=booking-uid&source=app-link",
    ],
    ["https://app.cal.com/event-types", "/(tabs)/(event-types)?source=app-link"],
    [
      "https://app.cal.com/event-types/123",
      "/(tabs)/(event-types)/event-type-detail?id=123&source=app-link",
    ],
    ["https://app.cal.com/availability", "/(tabs)/(availability)?source=app-link"],
    [
      "https://app.cal.com/availability/456",
      "/(tabs)/(availability)/availability-detail?id=456&source=app-link",
    ],
    ["https://app.cal.com/more", "/(tabs)/(more)?source=app-link"],
    ["https://app.cal.eu/bookings/past", "/(tabs)/(bookings)?filter=past&source=app-link"],
  ])("maps %s to %s", (appLink, nativeRoute) => {
    expect(getNativeRouteFromAppLink(appLink)).toBe(nativeRoute);
  });

  test.each([
    "https://cal.com/peer",
    "https://app.cal.com/apps",
    "https://app.cal.com/bookings/invalid",
    "https://app.cal.com/event-types/not-an-id",
    "https://example.com/bookings",
    "calcom://bookings",
    "/bookings",
  ])("leaves unsupported links unchanged: %s", (path) => {
    expect(getNativeRouteFromAppLink(path)).toBe(path);
  });
});
