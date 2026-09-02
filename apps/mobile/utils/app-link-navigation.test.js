import { describe, expect, test } from "@jest/globals";
import { getNativeRouteFromAppLink } from "@/utils/app-link-navigation";
import { CAL_APP_URLS } from "@/utils/cal-app-url";

describe("getNativeRouteFromAppLink", () => {
  const { us: usAppUrl, eu: euAppUrl } = CAL_APP_URLS;

  test.each([
    [`${usAppUrl}/bookings`, "/(tabs)/(bookings)?source=app-link"],
    [`${usAppUrl}/bookings/unconfirmed`, "/(tabs)/(bookings)?filter=unconfirmed&source=app-link"],
    [`${usAppUrl}/bookings/recurring`, "/(tabs)/(bookings)?filter=recurring&source=app-link"],
    [`${usAppUrl}/bookings/cancelled`, "/(tabs)/(bookings)?filter=cancelled&source=app-link"],
    [
      `${usAppUrl}/bookings/upcoming?uid=booking-uid`,
      "/(tabs)/(bookings)/booking-detail?uid=booking-uid&source=app-link",
    ],
    [
      `${usAppUrl}/booking/booking-uid`,
      "/(tabs)/(bookings)/booking-detail?uid=booking-uid&source=app-link",
    ],
    [`${usAppUrl}/event-types`, "/(tabs)/(event-types)?source=app-link"],
    [
      `${usAppUrl}/event-types/123`,
      "/(tabs)/(event-types)/event-type-detail?id=123&source=app-link",
    ],
    [`${usAppUrl}/availability`, "/(tabs)/(availability)?source=app-link"],
    [
      `${usAppUrl}/availability/456`,
      "/(tabs)/(availability)/availability-detail?id=456&source=app-link",
    ],
    [`${usAppUrl}/more`, "/(tabs)/(more)?source=app-link"],
    [`${euAppUrl}/bookings/past`, "/(tabs)/(bookings)?filter=past&source=app-link"],
  ])("maps %s to %s", (appLink, nativeRoute) => {
    expect(getNativeRouteFromAppLink(appLink)).toBe(nativeRoute);
  });

  test.each([
    `${usAppUrl.replace("://app.", "://")}/peer`,
    `${usAppUrl}/apps`,
    `${usAppUrl}/bookings/invalid`,
    `${usAppUrl}/event-types/not-an-id`,
    "https://example.com/bookings",
    "calcom://bookings",
    "/bookings",
  ])("leaves unsupported links unchanged: %s", (path) => {
    expect(getNativeRouteFromAppLink(path)).toBe(path);
  });
});
