import { describe, expect, test } from "@jest/globals";

const {
  buildVideoCallHref,
  isValidRoomSlug,
  linkAddress,
  parseCalVideoLink,
  roomAddress,
} = require("./cal-video-links");
const { getCalAppUrl, getCalWebUrl } = require("./region");

describe("parseCalVideoLink", () => {
  test("parses a root room", () => {
    expect(parseCalVideoLink("https://cal.video/socket-myrtle-walrus")).toEqual({
      kind: "room",
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

  test("parses a booking's meeting page on the app and marketing hosts of both regions", () => {
    for (const origin of [
      getCalAppUrl("us"),
      getCalAppUrl("eu"),
      getCalWebUrl("us"),
      getCalWebUrl("eu"),
    ]) {
      const link = parseCalVideoLink(`${origin}/video/8t9GuhHULYiWHEtZqyhmbV`);
      expect(link).toEqual({
        kind: "booking",
        origin,
        host: new URL(origin).host,
        bookingUid: "8t9GuhHULYiWHEtZqyhmbV",
        url: `${origin}/video/8t9GuhHULYiWHEtZqyhmbV`,
      });
      expect(linkAddress(link)).toBe(`${new URL(origin).host}/video/8t9GuhHULYiWHEtZqyhmbV`);
    }
    // Case and a trailing slash on the path are tolerated; the uid itself keeps its case.
    expect(parseCalVideoLink(`${getCalAppUrl("us")}/Video/AbC-1_2/`)).toMatchObject({
      kind: "booking",
      bookingUid: "AbC-1_2",
    });
    expect(
      parseCalVideoLink(
        `calcom://video?url=${encodeURIComponent(`${getCalAppUrl("us")}/video/abc`)}`
      )
    ).toMatchObject({ kind: "booking", bookingUid: "abc" });
  });

  test("rejects booking-host paths that are not a meeting", () => {
    const app = getCalAppUrl("us");
    for (const url of [
      `${app}/video`,
      `${app}/video/no-meeting-found`,
      `${app}/video/meeting-ended/abc`,
      `${app}/video/abc/extra`,
      `${app}/video/${"x".repeat(65)}`,
      `${app}/video/bad%20uid`,
      `${app}/bookings`,
      `${app}/peer/30min`,
      "https://evil-app.cal.com.example/video/abc",
    ]) {
      expect(parseCalVideoLink(url)).toBeNull();
    }
  });

  test("rejects anything that is not a room", () => {
    for (const url of [
      "https://cal.video/",
      "https://www.cal.video/peer",
      "https://a.b.cal.video/peer",
      "https://cal.video/login",
      "https://cal.video/peer/extra",
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
