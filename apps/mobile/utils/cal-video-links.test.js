import { describe, expect, test } from "@jest/globals";

const {
  buildVideoCallHref,
  isValidRoomSlug,
  parseCalVideoLink,
  roomAddress,
} = require("./cal-video-links");

describe("parseCalVideoLink", () => {
  test("parses a root room", () => {
    expect(parseCalVideoLink("https://cal.video/socket-myrtle-walrus")).toEqual({
      origin: "https://cal.video",
      host: "cal.video",
      orgSlug: null,
      slug: "socket-myrtle-walrus",
      inviteToken: null,
      url: "https://cal.video/socket-myrtle-walrus",
    });
  });

  test("parses an organization member and team room", () => {
    expect(parseCalVideoLink("https://i.cal.video/peer")).toMatchObject({
      origin: "https://i.cal.video",
      host: "i.cal.video",
      orgSlug: "i",
      slug: "peer",
    });
    expect(parseCalVideoLink("https://acme.cal.video/john-doe")).toMatchObject({
      orgSlug: "acme",
      slug: "john-doe",
    });
  });

  test("keeps the invite token from the fragment and never in the path", () => {
    const link = parseCalVideoLink("https://i.cal.video/sales#i=abc.def");
    expect(link?.inviteToken).toBe("abc.def");
    expect(link?.url).toBe("https://i.cal.video/sales#i=abc.def");
    expect(buildVideoCallHref(link)).toBe(
      `/video-call?url=${encodeURIComponent("https://i.cal.video/sales#i=abc.def")}`
    );
  });

  test("normalises case and a trailing slash", () => {
    expect(parseCalVideoLink("HTTPS://I.Cal.Video/Peer/")).toMatchObject({
      host: "i.cal.video",
      slug: "peer",
    });
  });

  test("accepts the app scheme forms", () => {
    expect(
      parseCalVideoLink(`calcom://video?url=${encodeURIComponent("https://i.cal.video/peer")}`)
    ).toMatchObject({ host: "i.cal.video", slug: "peer" });
    expect(parseCalVideoLink("calcom://video/i.cal.video/peer")).toMatchObject({
      host: "i.cal.video",
      slug: "peer",
    });
    expect(parseCalVideoLink("calcom:///video/cal.video/abc")).toMatchObject({ slug: "abc" });
  });

  test("rejects anything that is not a room", () => {
    for (const url of [
      "https://cal.video/",
      "https://www.cal.video/peer",
      "https://a.b.cal.video/peer",
      "https://cal.video/login",
      "https://cal.video/peer/extra",
      "https://app.cal.com/video/abc",
      "https://cal.video/Bad_Slug",
      "https://cal.video/-peer",
      "https://evilcal.video/peer",
      "calcom://bookings?uid=1",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(parseCalVideoLink(url)).toBeNull();
    }
  });
});

describe("isValidRoomSlug", () => {
  test("follows the web slug policy", () => {
    expect(isValidRoomSlug("peer")).toBe(true);
    expect(isValidRoomSlug("socket-myrtle-walrus")).toBe(true);
    expect(isValidRoomSlug("a".repeat(64))).toBe(true);
    expect(isValidRoomSlug("a".repeat(65))).toBe(false);
    expect(isValidRoomSlug("double--hyphen")).toBe(false);
    expect(isValidRoomSlug("api")).toBe(false);
    expect(isValidRoomSlug("")).toBe(false);
  });
});

describe("roomAddress", () => {
  test("reads like the web header", () => {
    expect(roomAddress({ host: "i.cal.video", slug: "peer" })).toBe("i.cal.video/peer");
  });
});
