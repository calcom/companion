import { describe, expect, test } from "@jest/globals";

const {
  buildCreateCalEventDefaults,
  buildCreateCalEventInput,
  formatSentenceDateTime,
  formatSentenceEnd,
  getCreateCalEventError,
  isMultiDay,
  minEndWallTime,
  moveStart,
  parseLocationInput,
  sentenceLocationDisplay,
} = require("./cal-event-create");

function values(overrides = {}) {
  return {
    name: "Rooftop meetup",
    startWallTime: "2026-10-20T19:00",
    endWallTime: "2026-10-20T21:00",
    timeZone: "Europe/Madrid",
    isPrivate: false,
    location: "",
    requiresApproval: false,
    ...overrides,
  };
}

describe("buildCreateCalEventDefaults", () => {
  test("starts at the next whole hour in the event's zone and lasts an hour", () => {
    expect(buildCreateCalEventDefaults("Europe/Madrid", new Date("2026-10-19T05:20:00Z"))).toEqual({
      name: "",
      startWallTime: "2026-10-19T08:00",
      endWallTime: "2026-10-19T09:00",
      timeZone: "Europe/Madrid",
      isPrivate: false,
      location: "",
      requiresApproval: false,
    });
  });
});

describe("parseLocationInput", () => {
  test("is nothing when empty", () => {
    expect(parseLocationInput("   ")).toBeNull();
  });

  test("turns a URL into a meeting link", () => {
    expect(parseLocationInput(" https://zoom.us/j/123 ")).toEqual({
      type: "link",
      link: "https://zoom.us/j/123",
    });
  });

  test("adds https to a bare host", () => {
    expect(parseLocationInput("meet.google.com/abc-defg-hij")).toEqual({
      type: "link",
      link: "https://meet.google.com/abc-defg-hij",
    });
  });

  test("takes anything else as an address", () => {
    expect(parseLocationInput("Calle Mayor 1, Madrid")).toEqual({
      type: "address",
      address: "Calle Mayor 1, Madrid",
    });
    expect(parseLocationInput("Room 4.2")).toEqual({ type: "address", address: "Room 4.2" });
  });

  test("takes a protocol with no host as an address", () => {
    expect(parseLocationInput("https://")).toEqual({ type: "address", address: "https://" });
  });
});

describe("sentenceLocationDisplay", () => {
  test("puts 'at' before an address", () => {
    expect(sentenceLocationDisplay("Calle Mayor 1", false)).toEqual({
      prefix: "at",
      text: "Calle Mayor 1",
    });
  });

  test("shows only a link's host until the field is focused", () => {
    expect(sentenceLocationDisplay("https://www.zoom.us/j/123", false)).toEqual({
      prefix: "online on",
      text: "zoom.us",
    });
    expect(sentenceLocationDisplay("https://www.zoom.us/j/123", true)).toEqual({
      prefix: "online on",
      text: "https://www.zoom.us/j/123",
    });
  });

  test("has no prefix while empty, so the placeholder reads 'somewhere'", () => {
    expect(sentenceLocationDisplay("", false)).toEqual({ prefix: null, text: "" });
  });
});

describe("the sentence's times", () => {
  test("a new start carries the end along", () => {
    expect(moveStart(values(), "2026-10-21T10:30")).toEqual({
      startWallTime: "2026-10-21T10:30",
      endWallTime: "2026-10-21T12:30",
    });
  });

  test("the end is at least 15 minutes after the start", () => {
    expect(minEndWallTime("2026-10-20T23:50")).toBe("2026-10-21T00:05");
  });

  test("reads 'Oct 19 at 07:00'", () => {
    expect(formatSentenceDateTime("2026-10-19T07:00")).toBe("Oct 19 at 07:00");
  });

  test("shows only the end time on the start's day, else its date too", () => {
    expect(isMultiDay(values())).toBe(false);
    expect(formatSentenceEnd(values())).toBe("21:00");
    const multiDay = values({ endWallTime: "2026-10-22T02:00" });
    expect(isMultiDay(multiDay)).toBe(true);
    expect(formatSentenceEnd(multiDay)).toBe("Oct 22 at 02:00");
  });
});

describe("getCreateCalEventError", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  test("asks for a name first", () => {
    expect(getCreateCalEventError(values({ name: "  " }), now)).toBe("Required");
  });

  test("refuses a start that has passed in the event's zone", () => {
    // 13:00 in Madrid is 11:00 UTC.
    expect(getCreateCalEventError(values({ startWallTime: "2026-10-19T13:00" }), now)).toBe(
      "Start date must be in the future"
    );
    expect(getCreateCalEventError(values(), now)).toBeNull();
  });
});

describe("buildCreateCalEventInput", () => {
  test("sends UTC instants, the zone and the options", () => {
    expect(
      buildCreateCalEventInput(
        values({ name: "  Rooftop meetup ", isPrivate: true, requiresApproval: true })
      )
    ).toEqual({
      title: "Rooftop meetup",
      startTime: "2026-10-20T17:00:00.000Z",
      endTime: "2026-10-20T19:00:00.000Z",
      timeZone: "Europe/Madrid",
      visibility: "UNLISTED",
      requiresApproval: true,
    });
  });

  test("leaves the location out when empty, so the server adds Cal Video", () => {
    expect(buildCreateCalEventInput(values())).not.toHaveProperty("locations");
  });

  test("sends the parsed location", () => {
    expect(buildCreateCalEventInput(values({ location: "zoom.us/j/1" })).locations).toEqual([
      { type: "link", link: "https://zoom.us/j/1" },
    ]);
    expect(buildCreateCalEventInput(values({ location: "Calle Mayor 1" })).locations).toEqual([
      { type: "address", address: "Calle Mayor 1" },
    ]);
  });
});
