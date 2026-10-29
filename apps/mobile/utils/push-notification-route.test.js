import { describe, expect, test } from "@jest/globals";
import { getPushNotificationRoute } from "./push-notification-route";

const hosts = new Set(["app.example.test", "app.eu.example.test"]);
const uuid = "019f8549-65f0-7915-a8a5-0f8ce3b6f80a";

describe("push notification routing", () => {
  test.each([...hosts])("opens full and short Cal Event UUIDs natively on %s", (host) => {
    for (const id of [uuid, uuid.toUpperCase(), "1cCfrjhx4YthJNBhMZSYGs"]) {
      expect(
        getPushNotificationRoute(`https://${host}/events/${id}?tabName=guests`, hosts)
      ).toEqual({
        kind: "cal-event",
        uuid,
      });
    }
  });

  test.each([
    ["https://app.example.test/booking?uid=booking-1", "booking-1"],
    ["companion://booking?uid=a%252Fb", "a/b"],
    ["https://other.example.test/?uid=first&uid=last", "last"],
    [`https://app.example.test/events/${uuid}?uid=booking`, "booking"],
  ])("preserves existing booking uid routing for %s", (url, uid) => {
    expect(getPushNotificationRoute(url, hosts)).toEqual({ kind: "booking", uid });
  });

  test.each([
    "https://app.example.test/booking/confirm-proposal?proposalUuid=proposal&token=review-token",
    "https://app.eu.example.test/settings",
    "https://app.example.test/events/invalid",
    "https://app.example.test/events/ZZZZZZZZZZZZZZZZZZZZZZ",
    `https://app.example.test/events/${uuid}/guests`,
  ])("opens other trusted URLs in the browser without changing their query: %s", (url) => {
    expect(getPushNotificationRoute(url, hosts)).toEqual({ kind: "web", url });
  });

  test.each([
    "",
    "not a url",
    "javascript:alert(1)",
    "https://evil.example.test/booking/confirm-proposal",
    `https://app.example.test.evil.test/events/${uuid}`,
    `http://app.example.test/events/${uuid}`,
    `https://app.example.test:444/events/${uuid}`,
    `https://user:password@app.example.test/events/${uuid}`,
  ])("ignores malformed or untrusted non-booking URLs: %s", (url) => {
    expect(getPushNotificationRoute(url, hosts)).toBeNull();
  });
});
