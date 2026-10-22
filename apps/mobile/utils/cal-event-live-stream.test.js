import { describe, expect, test } from "@jest/globals";
import {
  CAL_EVENT_LIVE_STREAM_INVALID,
  CAL_EVENT_LIVE_STREAM_TOO_LONG,
  getCalEventLiveStreamError,
} from "./cal-event-live-stream";

describe("getCalEventLiveStreamError", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/live/abc_DEF-123",
    "https://m.youtube.com/embed/abc",
    "https://youtu.be/abc",
    "https://www.twitch.tv/some_channel",
    "https://twitch.tv/videos/123456",
    "https://x.com/calcom/status/1234567890",
    "https://twitter.com/calcom/status/1",
    "https://studio.restream.io/webinar/abc-123",
    "  https://YouTube.com/watch?v=abc  ",
  ])("accepts %s, as the web does", (url) => {
    expect(getCalEventLiveStreamError(url)).toBeNull();
  });

  test.each([
    "asdasd",
    "youtube.com/watch?v=abc",
    "ftp://youtube.com/watch?v=abc",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/channel/abc",
    "https://vimeo.com/123",
    "https://www.twitch.tv/videos/abc",
    "https://x.com/calcom",
    "https://studio.restream.io/abc",
    "https://www.youtube.com/watch?v=%E0%A4%A",
  ])("rejects %s", (url) => {
    expect(getCalEventLiveStreamError(url)).toBe(CAL_EVENT_LIVE_STREAM_INVALID);
  });

  test("an empty row says nothing; an overlong one says so", () => {
    expect(getCalEventLiveStreamError("  ")).toBeNull();
    expect(getCalEventLiveStreamError(`https://youtu.be/${"a".repeat(2048)}`)).toBe(
      CAL_EVENT_LIVE_STREAM_TOO_LONG
    );
  });
});
