import { describe, expect, test } from "@jest/globals";
import { resolveAppLink } from "@/utils/app-link-navigation";
import { getCalAppUrl } from "@/utils/region";

const US = getCalAppUrl("us");
const EU = getCalAppUrl("eu");

const opens = (path, base = US) => resolveAppLink(`${base}${path}`);

describe("resolveAppLink", () => {
  test("opens the bookings tab, on a filter when the link names one", () => {
    expect(opens("/bookings")).toEqual({
      kind: "screen",
      href: "/(tabs)/(bookings)?source=app-link",
    });
    expect(opens("/bookings/")).toEqual({
      kind: "screen",
      href: "/(tabs)/(bookings)?source=app-link",
    });
    for (const filter of ["upcoming", "unconfirmed", "recurring", "past", "cancelled"]) {
      expect(opens(`/bookings/${filter}`)).toEqual({
        kind: "screen",
        href: `/(tabs)/(bookings)?filter=${filter}&source=app-link`,
      });
    }
  });

  test("opens a booking's details from the web's details sheet address", () => {
    expect(opens("/bookings/upcoming?uid=r63umUSdfs8QX7ajaYiYhy")).toEqual({
      kind: "screen",
      href: "/(tabs)/(bookings)/booking-detail?uid=r63umUSdfs8QX7ajaYiYhy&source=app-link",
    });
    expect(opens("/bookings?uid=abc").kind).toBe("screen");
  });

  test("opens event types, and one event type by its id", () => {
    expect(opens("/event-types")).toEqual({
      kind: "screen",
      href: "/(tabs)/(event-types)?source=app-link",
    });
    expect(opens("/event-types/123?tabName=setup")).toEqual({
      kind: "screen",
      href: "/(tabs)/(event-types)/event-type-detail?id=123&source=app-link",
    });
  });

  test("opens availability, and one schedule by its id", () => {
    expect(opens("/availability")).toEqual({
      kind: "screen",
      href: "/(tabs)/(availability)?source=app-link",
    });
    expect(opens("/availability/45")).toEqual({
      kind: "screen",
      href: "/(tabs)/(availability)/availability-detail?id=45&source=app-link",
    });
  });

  test("opens the More tab", () => {
    expect(opens("/more")).toEqual({ kind: "screen", href: "/(tabs)/(more)?source=app-link" });
  });

  test("sends pages the app has no screen for to the web", () => {
    for (const path of [
      "/availability/troubleshoot",
      "/event-types/new",
      "/event-types/123/advanced",
      "/bookings/archived",
      "/more/settings",
      "/booking/r63umUSdfs8QX7ajaYiYhy?cancel=true",
      "/settings/my-account/profile",
      "/",
    ]) {
      expect(opens(path)).toEqual({ kind: "web", url: `${US}${path}` });
    }
  });

  test("reads the EU web app the same way", () => {
    expect(opens("/availability", EU)).toEqual({
      kind: "screen",
      href: "/(tabs)/(availability)?source=app-link",
    });
  });

  test("leaves other links alone", () => {
    for (const input of [
      "http://example.com/bookings",
      "https://example.com/bookings",
      "https://i.cal.video/peer",
      "calcom://(tabs)/(bookings)/booking-detail?uid=abc123",
      "/(tabs)/(bookings)",
      "not a url",
    ]) {
      expect(resolveAppLink(input)).toBeNull();
    }
    expect(resolveAppLink(`${US.replace("https:", "http:")}/bookings`)).toBeNull();
  });
});
