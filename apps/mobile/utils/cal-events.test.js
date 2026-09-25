import { describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.cal.com",
}));

const {
  filterCalEventsByTitle,
  formatCalEventDate,
  formatCalEventPrice,
  formatCalEventTime,
  formatCalEventTimeRange,
  getCalEventEditorUrl,
  getCalEventFacts,
  getCalEventLocationLabel,
  groupCalEvents,
} = require("./cal-events");

const NOW = new Date("2026-09-25T12:00:00.000Z");

function createEvent(overrides = {}) {
  return {
    eventTypeUuid: "019f8549-65f0-7915-a8a5-0f8ce3b6f80a",
    eventTypeId: 1,
    title: "Rio turns one",
    slug: "rio-turns-one",
    description: null,
    publicUrl: "https://cal.com/rio-turns-one",
    status: "published",
    startTime: "2026-10-10T14:00:00.000Z",
    endTime: "2026-10-10T19:00:00.000Z",
    timeZone: "Europe/Berlin",
    category: "meetup",
    coverImageUrl: null,
    mapImageUrl: null,
    locationAddress: null,
    latitude: null,
    longitude: null,
    locations: [],
    liveStreams: [],
    visibility: "UNLISTED",
    requiresApproval: false,
    waitlistEnabled: false,
    showGuestList: true,
    guestListDisplay: "NAMES",
    price: null,
    currency: null,
    capacity: null,
    confirmedCount: 4,
    hosts: [],
    userId: 1,
    teamId: null,
    viewerIsCoHost: false,
    publishedAt: "2026-07-21T15:34:19.550Z",
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2026-07-21T15:26:47.789Z",
    updatedAt: "2026-09-23T10:13:12.240Z",
    ...overrides,
  };
}

describe("groupCalEvents", () => {
  test("splits drafts, upcoming and past, sorted like the web listing", () => {
    const draft = createEvent({
      eventTypeUuid: "d",
      status: "draft",
      startTime: "2026-12-01T10:00:00.000Z",
    });
    const soon = createEvent({ eventTypeUuid: "s", startTime: "2026-10-01T10:00:00.000Z" });
    const later = createEvent({ eventTypeUuid: "l", startTime: "2026-11-01T10:00:00.000Z" });
    const cancelledUpcoming = createEvent({
      eventTypeUuid: "cu",
      status: "cancelled",
      startTime: "2026-10-15T10:00:00.000Z",
    });
    const old = createEvent({
      eventTypeUuid: "o",
      status: "past",
      startTime: "2026-01-01T10:00:00.000Z",
    });
    const older = createEvent({
      eventTypeUuid: "oo",
      status: "past",
      startTime: "2025-01-01T10:00:00.000Z",
    });
    const cancelledPast = createEvent({
      eventTypeUuid: "cp",
      status: "cancelled",
      startTime: "2026-05-01T10:00:00.000Z",
    });

    const groups = groupCalEvents(
      [older, cancelledPast, later, old, draft, cancelledUpcoming, soon],
      NOW
    );

    expect(groups.map((g) => [g.kind, g.events.map((e) => e.eventTypeUuid)])).toEqual([
      ["drafts", ["d"]],
      ["upcoming", ["s", "cu", "l"]],
      ["past", ["cp", "o", "oo"]],
    ]);
  });

  test("omits empty groups", () => {
    expect(groupCalEvents([createEvent()], NOW).map((g) => g.kind)).toEqual(["upcoming"]);
    expect(groupCalEvents([], NOW)).toEqual([]);
  });
});

describe("filterCalEventsByTitle", () => {
  test("matches case-insensitively and ignores surrounding whitespace", () => {
    const events = [createEvent({ title: "LAN Party" }), createEvent({ title: "Wedding" })];
    expect(filterCalEventsByTitle(events, "  lan ").map((e) => e.title)).toEqual(["LAN Party"]);
    expect(filterCalEventsByTitle(events, "")).toHaveLength(2);
  });
});

describe("getCalEventFacts", () => {
  test("says only what differs from a plain free public event", () => {
    expect(getCalEventFacts(createEvent({ confirmedCount: 0, visibility: "PUBLIC" }))).toEqual([]);
    expect(getCalEventFacts(createEvent())).toEqual(["4 going", "Unlisted"]);
    expect(
      getCalEventFacts(createEvent({ confirmedCount: 3, capacity: 8, visibility: "PUBLIC" }))
    ).toEqual(["3 going", "8 cap"]);
  });

  test("reads a full event as sold out, or as waitlisting when enabled", () => {
    expect(
      getCalEventFacts(createEvent({ confirmedCount: 8, capacity: 8, visibility: "PUBLIC" }))
    ).toEqual(["8/8 full", "Sold out"]);
    expect(
      getCalEventFacts(
        createEvent({ confirmedCount: 9, capacity: 8, waitlistEnabled: true, visibility: "PUBLIC" })
      )
    ).toEqual(["9/8 full", "Waitlist"]);
  });

  test("treats a missing confirmedCount (single-event response) as nobody going", () => {
    expect(
      getCalEventFacts(createEvent({ confirmedCount: null, capacity: 50, visibility: "PUBLIC" }))
    ).toEqual(["0 going", "50 cap"]);
  });

  test("formats a price from the smallest currency unit", () => {
    expect(
      getCalEventFacts(createEvent({ price: 1500, currency: "eur", visibility: "PUBLIC" }))
    ).toEqual(["4 going", "€15.00"]);
    expect(formatCalEventPrice(999, "usd")).toBe("$9.99");
  });
});

describe("getCalEventLocationLabel", () => {
  test("is Online without a venue address", () => {
    expect(getCalEventLocationLabel(createEvent())).toBe("Online");
    expect(getCalEventLocationLabel(createEvent({ locationAddress: "  " }))).toBe("Online");
    expect(getCalEventLocationLabel(createEvent({ locationAddress: "La Geria" }))).toBe("La Geria");
  });
});

describe("date formatting", () => {
  test("renders the start in the event's own timezone, without the year inside the current one", () => {
    // 14:00Z is 16:00 in Berlin (CEST).
    expect(
      formatCalEventDate(
        "2026-10-10T14:00:00.000Z",
        "2026-10-10T19:00:00.000Z",
        "Europe/Berlin",
        NOW
      )
    ).toBe("Sat, Oct 10");
    expect(formatCalEventTime("2026-10-10T14:00:00.000Z", "Europe/Berlin")).toBe("4:00 PM");
    expect(
      formatCalEventTimeRange(
        "2026-10-10T14:00:00.000Z",
        "2026-10-10T19:00:00.000Z",
        "Europe/Berlin"
      )
    ).toBe("4:00 PM – 9:00 PM");
  });

  test("shows a multi-day range and adds the year outside the current one", () => {
    expect(
      formatCalEventDate(
        "2026-10-30T20:00:00.000Z",
        "2026-11-01T10:00:00.000Z",
        "Europe/Berlin",
        NOW
      )
    ).toBe("Fri, Oct 30 – Sun, Nov 1");
    expect(
      formatCalEventDate(
        "2027-05-08T07:00:00.000Z",
        "2027-05-08T21:59:00.000Z",
        "Atlantic/Canary",
        NOW
      )
    ).toBe("Sat, May 8, 2027");
  });

  test("crosses midnight correctly when the venue is ahead of UTC", () => {
    // 23:30Z on Oct 10 is already Oct 11 in Tokyo.
    expect(
      formatCalEventDate("2026-10-10T23:30:00.000Z", "2026-10-11T01:00:00.000Z", "Asia/Tokyo", NOW)
    ).toBe("Sun, Oct 11");
  });

  test("falls back to UTC for an unknown timezone instead of throwing", () => {
    expect(
      formatCalEventDate(
        "2026-10-10T14:00:00.000Z",
        "2026-10-10T19:00:00.000Z",
        "Mars/Olympus",
        NOW
      )
    ).toBe("Sat, Oct 10");
    expect(formatCalEventTime("2026-10-10T14:00:00.000Z", "Mars/Olympus")).toBe("2:00 PM");
  });
});

describe("getCalEventEditorUrl", () => {
  test("points at the web editor for the event", () => {
    expect(getCalEventEditorUrl("019f8549-65f0-7915-a8a5-0f8ce3b6f80a")).toBe(
      "https://app.cal.com/events/019f8549-65f0-7915-a8a5-0f8ce3b6f80a"
    );
  });
});
