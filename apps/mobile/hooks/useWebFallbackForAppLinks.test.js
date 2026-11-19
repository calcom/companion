import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("@/utils/browser", () => ({ openInAppBrowser: mockOpenInAppBrowser }));

const { renderHook } = require("@testing-library/react-native");
const { useWebFallbackForAppLinks } = require("./useWebFallbackForAppLinks");
const { getCalAppUrl } = require("@/utils/region");

const TROUBLESHOOT = `${getCalAppUrl("us")}/availability/troubleshoot`;

async function arrive(incoming) {
  return renderHook((props) => useWebFallbackForAppLinks(props), { initialProps: incoming });
}

describe("useWebFallbackForAppLinks", () => {
  beforeEach(() => mockOpenInAppBrowser.mockClear());

  test("opens a web app page the app has no screen for in the in-app browser", async () => {
    await arrive({ url: TROUBLESHOOT, seq: 0 });
    expect(mockOpenInAppBrowser).toHaveBeenCalledTimes(1);
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(TROUBLESHOOT, "Cal.com page");
  });

  test("opens it once per arrival, and again when the same link is tapped again", async () => {
    const { rerender } = await arrive({ url: TROUBLESHOOT, seq: 0 });
    await rerender({ url: TROUBLESHOOT, seq: 0 });
    expect(mockOpenInAppBrowser).toHaveBeenCalledTimes(1);
    await rerender({ url: TROUBLESHOOT, seq: 1 });
    expect(mockOpenInAppBrowser).toHaveBeenCalledTimes(2);
  });

  test("leaves screens, call links and other links to the router", async () => {
    for (const url of [
      `${getCalAppUrl("us")}/availability/45`,
      `${getCalAppUrl("us")}/video/r63umUSdfs8QX7ajaYiYhy`,
      "https://i.cal.video/peer",
      "calcom://(tabs)/(bookings)/booking-detail?uid=abc123",
    ]) {
      await arrive({ url, seq: 0 });
    }
    await arrive(null);
    expect(mockOpenInAppBrowser).not.toHaveBeenCalled();
  });
});
