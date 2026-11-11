import { describe, expect, test } from "@jest/globals";
import { redirectSystemPath } from "../app/+native-intent";

// Lives outside app/ so expo-router doesn't read it as a route.
describe("redirectSystemPath", () => {
  test("folds a Cal Video link into the video-call screen", () => {
    expect(redirectSystemPath({ path: "https://i.cal.video/peer", initial: false })).toBe(
      `/video-call?url=${encodeURIComponent("https://i.cal.video/peer")}`
    );
  });

  test("passes a booking link through for the router to open", () => {
    const path = "calcom://(tabs)/(bookings)/booking-detail?uid=abc123";
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });

  test("passes the sign-in callback through to its route", () => {
    const path = "expo-wxt-app://oauth/callback?code=xyz";
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});
