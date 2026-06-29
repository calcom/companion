import { describe, expect, test } from "@jest/globals";
import { getInitialLandingRedirectDecision } from "@/utils/landing-page-navigation";

describe("getInitialLandingRedirectDecision", () => {
  test("redirects event-types preference from the tabs root", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "event-types",
        segments: ["(tabs)"],
      })
    ).toBe("redirect");
  });

  test("redirects event-types preference from the default bookings index", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "event-types",
        segments: ["(tabs)", "(bookings)"],
      })
    ).toBe("redirect");
  });

  test("redirects bookings unconfirmed preference from the default bookings index", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "bookings:unconfirmed",
        segments: ["(tabs)", "(bookings)", "index"],
      })
    ).toBe("redirect");
  });

  test("skips redirect when bookings is already the preferred default", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "bookings",
        segments: ["(tabs)", "(bookings)"],
      })
    ).toBe("skip");
  });

  test("skips redirect for booking detail notification deep links", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "event-types",
        segments: ["(tabs)", "(bookings)", "booking-detail"],
      })
    ).toBe("skip");
  });

  test("waits while segments are empty or outside the tabs layout", () => {
    expect(
      getInitialLandingRedirectDecision({
        landingPage: "event-types",
        segments: [],
      })
    ).toBe("wait");

    expect(
      getInitialLandingRedirectDecision({
        landingPage: "event-types",
        segments: ["profile-sheet"],
      })
    ).toBe("wait");
  });
});
