import { describe, expect, jest, test } from "@jest/globals";

// Hostnames are stubbed: the region helpers own the real ones.
jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const {
  canDeleteCalEvent,
  canManageCalEventLifecycle,
  canReadCalEvents,
  deriveCalEventStatus,
  filterCalEventsByTitle,
  formatCalEventDate,
  formatCalEventPrice,
  formatCalEventTime,
  formatCalEventTimeRange,
  getCalEventEditorUrl,
  getCalEventFacts,
  getCalEventLocationLabel,
  getCalEventPublicUrl,
  getCalEventsProfileTeams,
  groupCalEvents,
  needsSignInAgainForCalEvents,
} = require("./cal-events");

const NOW = new Date("2026-09-25T12:00:00.000Z");

function createEvent(overrides = {}) {
  return {
    uuid: "019f8549-65f0-7915-a8a5-0f8ce3b6f80a",
    title: "Rio turns one",
    slug: "rio-turns-one",
    description: null,
    publicUrl: "https://example.test/rio-turns-one",
    status: "published",
    startTime: "2026-10-10T14:00:00.000Z",
    endTime: "2026-10-10T19:00:00.000Z",
    timeZone: "Europe/Berlin",
    coverImageUrl: null,
    locationAddress: null,
    locations: [],
    visibility: "UNLISTED",
    hidden: false,
    requiresApproval: false,
    waitlistEnabled: false,
    price: null,
    currency: null,
    capacity: null,
    confirmedCount: 4,
    hosts: [],
    userId: 1,
    teamId: null,
    publishedAt: "2026-07-21T15:34:19.550Z",
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe("groupCalEvents", () => {
  test("splits drafts, upcoming and past, sorted like the web listing", () => {
    const draft = createEvent({
      uuid: "d",
      status: "draft",
      startTime: "2026-12-01T10:00:00.000Z",
    });
    const soon = createEvent({ uuid: "s", startTime: "2026-10-01T10:00:00.000Z" });
    const later = createEvent({ uuid: "l", startTime: "2026-11-01T10:00:00.000Z" });
    const cancelledUpcoming = createEvent({
      uuid: "cu",
      status: "cancelled",
      startTime: "2026-10-15T10:00:00.000Z",
    });
    const old = createEvent({
      uuid: "o",
      status: "past",
      startTime: "2026-01-01T10:00:00.000Z",
    });
    const older = createEvent({
      uuid: "oo",
      status: "past",
      startTime: "2025-01-01T10:00:00.000Z",
    });
    const cancelledPast = createEvent({
      uuid: "cp",
      status: "cancelled",
      startTime: "2026-05-01T10:00:00.000Z",
    });

    const groups = groupCalEvents(
      [older, cancelledPast, later, old, draft, cancelledUpcoming, soon],
      NOW
    );

    expect(groups.map((g) => [g.kind, g.events.map((e) => e.uuid)])).toEqual([
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
      getCalEventFacts(
        createEvent({ confirmedCount: undefined, capacity: 50, visibility: "PUBLIC" })
      )
    ).toEqual(["0 going", "50 cap"]);
  });

  test("formats a price from the smallest currency unit", () => {
    expect(
      getCalEventFacts(createEvent({ price: 1500, currency: "eur", visibility: "PUBLIC" }))
    ).toEqual(["4 going", "€15.00"]);
    expect(formatCalEventPrice(999, "usd")).toBe("$9.99");
  });

  test("falls back to the amount and code for a malformed currency code", () => {
    // Intl throws only for a malformed code; a well-formed unknown one like "XYZ" still formats.
    expect(formatCalEventPrice(1500, "euro")).toBe("15.00 EURO");
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

describe("deriveCalEventStatus", () => {
  test("reads cancelled, draft, past and published from the timestamps", () => {
    expect(
      deriveCalEventStatus(createEvent({ cancelledAt: "2026-09-01T00:00:00.000Z" }), NOW)
    ).toBe("cancelled");
    expect(deriveCalEventStatus(createEvent({ publishedAt: null }), NOW)).toBe("draft");
    expect(deriveCalEventStatus(createEvent({ endTime: "2026-09-25T11:59:00.000Z" }), NOW)).toBe(
      "past"
    );
    expect(deriveCalEventStatus(createEvent(), NOW)).toBe("published");
  });
});

describe("urls", () => {
  test("point at the public page and the web editor", () => {
    expect(getCalEventPublicUrl("rio-turns-one")).toBe("https://example.test/rio-turns-one");
    expect(getCalEventEditorUrl("019f8549-65f0-7915-a8a5-0f8ce3b6f80a")).toBe(
      "https://app.example.test/events/019f8549-65f0-7915-a8a5-0f8ce3b6f80a"
    );
  });
});

describe("getCalEventsProfileTeams", () => {
  test("drops organizations and keeps their sub-teams", () => {
    const org = { id: 1, name: "Acme Inc", isOrganization: true };
    const team = { id: 2, name: "Team 1", parentId: 1, isOrganization: false };
    expect(getCalEventsProfileTeams([org, team])).toEqual([team]);
  });
});

describe("canReadCalEvents", () => {
  test("needs the personal, team and teams-list read scopes in the token's scope", () => {
    expect(
      canReadCalEvents("EVENT_TYPE_READ BOOKING_READ EVENT_READ TEAM_EVENT_READ TEAM_PROFILE_READ")
    ).toBe(true);
    expect(canReadCalEvents("EVENT_TYPE_READ BOOKING_READ PROFILE_READ")).toBe(false);
    expect(canReadCalEvents("TEAM_EVENT_READ")).toBe(false);
  });

  test("can't read when any one of them is missing", () => {
    // Without TEAM_EVENT_READ, a team's 403 would read as a membership problem.
    expect(canReadCalEvents("EVENT_READ TEAM_PROFILE_READ")).toBe(false);
    expect(canReadCalEvents("EVENT_READ TEAM_EVENT_READ")).toBe(false);
    expect(canReadCalEvents("TEAM_EVENT_READ TEAM_PROFILE_READ")).toBe(false);
  });

  test("treats a token with no recorded scope as pre-Events", () => {
    expect(canReadCalEvents(null)).toBe(false);
    expect(canReadCalEvents(undefined)).toBe(false);
  });
});

describe("needsSignInAgainForCalEvents", () => {
  const PRE_EVENTS_SCOPE = "EVENT_TYPE_READ BOOKING_READ PROFILE_READ";
  const EVENTS_SCOPE = `${PRE_EVENTS_SCOPE} EVENT_READ EVENT_WRITE TEAM_EVENT_READ TEAM_PROFILE_READ`;

  test("never asks a web session, which has no OAuth scope", () => {
    expect(needsSignInAgainForCalEvents({ isWebSession: true, oauthScope: null })).toBe(false);
    expect(needsSignInAgainForCalEvents({ isWebSession: true, oauthScope: PRE_EVENTS_SCOPE })).toBe(
      false
    );
  });

  test("asks an OAuth session whose token can't read events", () => {
    expect(
      needsSignInAgainForCalEvents({ isWebSession: false, oauthScope: PRE_EVENTS_SCOPE })
    ).toBe(true);
    expect(needsSignInAgainForCalEvents({ isWebSession: false, oauthScope: null })).toBe(true);
    expect(needsSignInAgainForCalEvents({ isWebSession: false, oauthScope: EVENTS_SCOPE })).toBe(
      false
    );
  });

  test("asks an OAuth session that can read personal events but not a team's", () => {
    expect(
      needsSignInAgainForCalEvents({
        isWebSession: false,
        oauthScope: `${PRE_EVENTS_SCOPE} EVENT_READ EVENT_WRITE TEAM_PROFILE_READ`,
      })
    ).toBe(true);
  });
});

describe("canManageCalEventLifecycle", () => {
  const ME = 7;
  const host = (userId) => ({ userId, name: `User ${userId}`, avatarUrl: "" });

  test("lets the owner and the hosts manage the event", () => {
    expect(canManageCalEventLifecycle(createEvent({ userId: ME, hosts: [host(ME)] }), ME)).toBe(
      true
    );
    expect(
      canManageCalEventLifecycle(
        createEvent({ userId: null, teamId: 3, hosts: [host(1), host(ME)] }),
        ME
      )
    ).toBe(true);
  });

  test("hides the actions from a team member who isn't a host", () => {
    expect(
      canManageCalEventLifecycle(createEvent({ userId: 1, teamId: 3, hosts: [host(1)] }), ME)
    ).toBe(false);
  });

  test("hides the actions until the viewer is known", () => {
    expect(
      canManageCalEventLifecycle(createEvent({ userId: ME, hosts: [host(ME)] }), undefined)
    ).toBe(false);
  });
});

describe("canDeleteCalEvent", () => {
  const draft = { status: "draft", publishedAt: null, confirmedCount: 0 };
  const PAID = { price: 1500, currency: "USD" };

  test("allows deleting a draft", () => {
    expect(canDeleteCalEvent(createEvent(draft))).toBe(true);
  });

  test("allows deleting a paid draft, which has no payment records yet", () => {
    expect(canDeleteCalEvent(createEvent({ ...draft, ...PAID }))).toBe(true);
  });

  test("allows deleting an upcoming free event with no confirmed guests", () => {
    expect(canDeleteCalEvent(createEvent({ confirmedCount: 0 }))).toBe(true);
  });

  test("blocks deleting an upcoming event with confirmed guests, which must be cancelled first", () => {
    expect(canDeleteCalEvent(createEvent({ confirmedCount: 4 }))).toBe(false);
  });

  test("allows deleting a cancelled free event although its old guests still count", () => {
    expect(
      canDeleteCalEvent(
        createEvent({
          status: "cancelled",
          cancelledAt: "2026-09-20T10:00:00.000Z",
          confirmedCount: 4,
        })
      )
    ).toBe(true);
  });

  test("blocks deleting a published paid event, upcoming, past or cancelled", () => {
    for (const status of ["published", "past", "cancelled"]) {
      expect(canDeleteCalEvent(createEvent({ ...PAID, status, confirmedCount: 0 }))).toBe(false);
    }
  });

  test("blocks deleting a past event with confirmed guests", () => {
    expect(canDeleteCalEvent(createEvent({ status: "past", confirmedCount: 4 }))).toBe(false);
  });

  test("blocks deleting an upcoming or past event whose guest count is unknown", () => {
    // The single-event response carries no confirmedCount, and the event may have guests.
    for (const status of ["published", "past"]) {
      expect(canDeleteCalEvent(createEvent({ status, confirmedCount: undefined }))).toBe(false);
    }
  });

  test("allows deleting a draft or cancelled event whose guest count is unknown", () => {
    expect(canDeleteCalEvent(createEvent({ ...draft, confirmedCount: undefined }))).toBe(true);
    expect(
      canDeleteCalEvent(
        createEvent({
          status: "cancelled",
          cancelledAt: "2026-09-20T10:00:00.000Z",
          confirmedCount: undefined,
        })
      )
    ).toBe(true);
  });
});
