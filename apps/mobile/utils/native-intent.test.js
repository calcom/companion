import { describe, expect, test } from "@jest/globals";
import { redirectSystemPath } from "../app/+native-intent";
import { getCalAppUrl } from "./region";

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

  test("opens a web app link on the matching screen", () => {
    const path = `${getCalAppUrl("us")}/availability/45`;
    expect(redirectSystemPath({ path, initial: true })).toBe(
      "/(tabs)/(availability)/availability-detail?id=45&source=app-link"
    );
  });

  test("keeps the router in place for a web app page the app has no screen for", () => {
    const path = `${getCalAppUrl("us")}/availability/troubleshoot`;
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(redirectSystemPath({ path, initial: true })).toBeNull();
  });

  test("still folds a booking call link into the video-call screen", () => {
    const path = `${getCalAppUrl("us")}/video/r63umUSdfs8QX7ajaYiYhy`;
    expect(redirectSystemPath({ path, initial: false })).toBe(
      `/video-call?url=${encodeURIComponent(path)}`
    );
  });

  test("passes the sign-in callback through to its route", () => {
    const path = "expo-wxt-app://oauth/callback?code=xyz";
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});
