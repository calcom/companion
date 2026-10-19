import { describe, expect, jest, test } from "@jest/globals";

// Hostnames are stubbed: the region helpers own the real ones.
jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));
// utils/cal-events.ts imports ApiRequestError: stub request.ts so its native networking isn't loaded.
jest.mock("@/services/calcom/request", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
  makeRequest: () => Promise.reject(new Error("not under test")),
}));

const {
  CAL_EVENT_INVALID_TICKET_MESSAGE,
  canCheckInCalEventGuests,
  createCalEventScanGate,
  canDeleteCalEvent,
  canManageCalEventLifecycle,
  canReadCalEvents,
  deriveCalEventStatus,
  filterCalEventGuests,
  filterCalEventsByTitle,
  formatCalEventCheckInTime,
  formatCalEventDate,
  formatCalEventPrice,
  formatCalEventTime,
  formatCalEventTimeRange,
  getCalEventCheckInAvailability,
  getCalEventCheckInAvailabilityDelayMs,
  getCalEventCheckInErrorMessage,
  getCalEventCheckInProgress,
  getCalEventCheckInWindowNotice,
  getCalEventEditorUrl,
  getCalEventFacts,
  getCalEventGuestName,
  getCalEventLinkActions,
  getCalEventLocationLabel,
  getCalEventPublicUrl,
  getCalEventsProfileTeams,
  getCalEventTicketCheckInErrorMessage,
  groupCalEvents,
  isCalEventCheckInTokenShaped,
  needsSignInAgainForCalEvents,
  refreshCalEventStatuses,
  setCalEventGuestCheckedInAt,
  sortCalEventGuests,
} = require("./cal-events");
const { ApiRequestError } = require("@/services/calcom/request");

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
    // An empty roster, so only the owner check can let the owner through.
    expect(canManageCalEventLifecycle(createEvent({ userId: ME, hosts: [] }), ME)).toBe(true);
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

describe("truncateCalEventTitle", () => {
  const { truncateCalEventTitle } = require("./cal-events");

  test("keeps a title that fits and cuts a longer one to 28 characters, the last one …", () => {
    expect(truncateCalEventTitle("Rio turns one")).toBe("Rio turns one");
    expect(truncateCalEventTitle("Rio turns one: a beach party in Lanzarote")).toBe(
      "Rio turns one: a beach part…"
    );
  });

  test("keeps an emoji at the cutoff whole instead of halving it into �", () => {
    // 🎉 is two UTF-16 units: as the 27th character, a cut at unit 27 would keep only its first.
    expect(truncateCalEventTitle(`${"a".repeat(26)}🎉 party`)).toBe(`${"a".repeat(26)}🎉…`);
  });

  test("counts an emoji as one character", () => {
    expect(truncateCalEventTitle("🎉".repeat(28))).toBe("🎉".repeat(28));
    expect(truncateCalEventTitle("🎉".repeat(29))).toBe(`${"🎉".repeat(27)}…`);
  });
});

describe("refreshCalEventStatuses", () => {
  // Fetched at NOW (12:00Z): a published event ending at 15:00Z, a cancelled one starting at 14:00Z.
  const endsToday = createEvent({
    uuid: "e",
    startTime: "2026-09-25T13:00:00.000Z",
    endTime: "2026-09-25T15:00:00.000Z",
  });
  const cancelledToday = createEvent({
    uuid: "c",
    status: "cancelled",
    cancelledAt: "2026-09-20T10:00:00.000Z",
    startTime: "2026-09-25T14:00:00.000Z",
    endTime: "2026-09-25T16:00:00.000Z",
  });
  const LATER = new Date("2026-09-25T15:30:00.000Z");
  const readAt = (events, now) =>
    groupCalEvents(refreshCalEventStatuses(events, now), now).map((g) => [
      g.kind,
      g.events.map((e) => `${e.uuid}:${e.status}`),
    ]);

  test("re-reads a cached list later: the ended event turns past, and both move to Past", () => {
    expect(readAt([endsToday, cancelledToday], NOW)).toEqual([
      ["upcoming", ["e:published", "c:cancelled"]],
    ]);
    expect(readAt([endsToday, cancelledToday], LATER)).toEqual([
      ["past", ["c:cancelled", "e:past"]],
    ]);
  });

  test("returns an event whose status holds as is, and leaves the cached one untouched", () => {
    const [ended, cancelled] = refreshCalEventStatuses([endsToday, cancelledToday], LATER);
    expect(cancelled).toBe(cancelledToday);
    expect(ended).toEqual({ ...endsToday, status: "past" });
    expect(endsToday.status).toBe("published");
  });
});

describe("getCalEventLinkActions", () => {
  test("lets an upcoming or past event open, copy and share its page", () => {
    for (const status of ["published", "past"]) {
      expect(getCalEventLinkActions(status)).toEqual({ canViewPage: true, canShare: true });
    }
  });

  test("lets a cancelled event open its cancellation notice but not copy or share the link", () => {
    expect(getCalEventLinkActions("cancelled")).toEqual({ canViewPage: true, canShare: false });
  });

  test("offers no page actions on a draft, whose page 404s until it is published", () => {
    expect(getCalEventLinkActions("draft")).toEqual({ canViewPage: false, canShare: false });
  });
});

describe("canCheckInCalEventGuests", () => {
  const ME = 7;
  const host = (userId) => ({ userId, name: `User ${userId}`, avatarUrl: "" });

  test("opens the door list to a host of a published or past event", () => {
    for (const status of ["published", "past"]) {
      expect(canCheckInCalEventGuests(createEvent({ status, userId: ME, hosts: [] }), ME)).toBe(
        true
      );
    }
  });

  test("offers no check-in on a draft or a cancelled event", () => {
    for (const status of ["draft", "cancelled"]) {
      expect(
        canCheckInCalEventGuests(createEvent({ status, userId: ME, hosts: [host(ME)] }), ME)
      ).toBe(false);
    }
  });

  test("hides it from a team member who isn't a host, and until the viewer is known", () => {
    const teamEvent = createEvent({ userId: null, teamId: 3, hosts: [host(1)] });
    expect(canCheckInCalEventGuests(teamEvent, ME)).toBe(false);
    expect(canCheckInCalEventGuests(teamEvent, undefined)).toBe(false);
  });
});

function createGuest(overrides = {}) {
  return {
    id: "registration-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phoneNumber: null,
    checkedInAt: null,
    ...overrides,
  };
}

describe("getCalEventGuestName", () => {
  test("lists a guest who gave no name by their email", () => {
    expect(getCalEventGuestName(createGuest())).toBe("Ada Lovelace");
    expect(getCalEventGuestName(createGuest({ name: "  " }))).toBe("ada@example.com");
  });
});

describe("sortCalEventGuests", () => {
  test("orders guests by name, ignoring case, then namesakes by email", () => {
    const guests = [
      createGuest({ id: "1", name: "grace Hopper", email: "grace@example.com" }),
      createGuest({ id: "2", name: "Ada Lovelace", email: "ada.b@example.com" }),
      createGuest({ id: "3", name: "Ada Lovelace", email: "ada.a@example.com" }),
      createGuest({ id: "4", name: "", email: "alan@example.com" }),
    ];

    expect(sortCalEventGuests(guests).map((guest) => guest.id)).toEqual(["3", "2", "4", "1"]);
  });

  test("leaves the cached list as it was", () => {
    const guests = [createGuest({ id: "1", name: "Zoe" }), createGuest({ id: "2", name: "Ada" })];
    sortCalEventGuests(guests);
    expect(guests.map((guest) => guest.id)).toEqual(["1", "2"]);
  });
});

describe("filterCalEventGuests", () => {
  const guests = [
    createGuest({ id: "1", name: "Ada Lovelace", email: "ada@example.com" }),
    createGuest({ id: "2", name: "Grace Hopper", email: "admiral@navy.example" }),
  ];

  test("matches a name or an email, ignoring case and surrounding spaces", () => {
    expect(filterCalEventGuests(guests, " LOVE ").map((guest) => guest.id)).toEqual(["1"]);
    expect(filterCalEventGuests(guests, "navy").map((guest) => guest.id)).toEqual(["2"]);
  });

  test("keeps every guest for an empty query", () => {
    expect(filterCalEventGuests(guests, "  ")).toBe(guests);
  });
});

describe("getCalEventCheckInProgress", () => {
  test("counts checked-in guests out of the confirmed ones", () => {
    const guests = [
      createGuest({ id: "1", checkedInAt: "2026-10-09T18:05:00.000Z" }),
      createGuest({ id: "2" }),
      createGuest({ id: "3" }),
    ];
    expect(getCalEventCheckInProgress({ guests })).toBe("1 of 3 checked in");
    expect(getCalEventCheckInProgress({ guests: [] })).toBe("0 of 0 checked in");
  });

  test("reads a list cached before every page was loaded the same way", () => {
    const guests = [createGuest({ checkedInAt: "2026-10-09T18:05:00.000Z" }), createGuest()];
    expect(getCalEventCheckInProgress({ guests, hasMore: true })).toBe("1 of 2 checked in");
  });
});

describe("setCalEventGuestCheckedInAt", () => {
  const list = { guests: [createGuest({ id: "1" }), createGuest({ id: "2" })] };

  test("checks one guest in, and the count with it", () => {
    const next = setCalEventGuestCheckedInAt(list, "2", "2026-10-09T18:05:00.000Z");

    expect(next.guests.map((guest) => guest.checkedInAt)).toEqual([
      null,
      "2026-10-09T18:05:00.000Z",
    ]);
    expect(getCalEventCheckInProgress(next)).toBe("1 of 2 checked in");
    expect(list.guests[1].checkedInAt).toBeNull();
  });

  test("undoes a check-in", () => {
    const checkedIn = setCalEventGuestCheckedInAt(list, "1", "2026-10-09T18:05:00.000Z");
    expect(setCalEventGuestCheckedInAt(checkedIn, "1", null).guests[0].checkedInAt).toBeNull();
  });

  test("leaves a cache that was cleared (logged out) empty", () => {
    expect(setCalEventGuestCheckedInAt(undefined, "1", null)).toBeUndefined();
  });
});

describe("getCalEventCheckInErrorMessage", () => {
  const apiError = (status, reason) =>
    new ApiRequestError(status, `API Error: ${status} ${reason}`);

  test("shows the API's reason outside the check-in window or on a cancelled event", () => {
    expect(
      getCalEventCheckInErrorMessage(apiError(400, "Check-in is closed outside the event window"))
    ).toBe("Check-in is closed outside the event window");
    expect(getCalEventCheckInErrorMessage(apiError(400, "This event has been cancelled"))).toBe(
      "This event has been cancelled"
    );
  });

  test("falls back when the API's 4xx error message is empty", () => {
    expect(getCalEventCheckInErrorMessage(apiError(400, ""))).toBe(
      "Something went wrong. Try again."
    );
  });

  test("explains a missing scope, a guest who is gone and a rate limit", () => {
    expect(getCalEventCheckInErrorMessage(apiError(403, "Forbidden"))).toMatch(/sign back in/);
    expect(getCalEventCheckInErrorMessage(apiError(404, "Registration not found"))).toBe(
      "This guest is no longer on the list."
    );
    expect(getCalEventCheckInErrorMessage(apiError(429, "Too many requests"))).toMatch(
      /Wait a moment/
    );
  });

  test("hides server errors and blames the connection when the request never got an answer", () => {
    expect(getCalEventCheckInErrorMessage(apiError(500, "Internal server error"))).toBe(
      "Something went wrong. Try again."
    );
    expect(getCalEventCheckInErrorMessage(new Error("Network request failed"))).toBe(
      "Check your connection and try again."
    );
  });
});

describe("formatCalEventCheckInTime", () => {
  test("reads the time on the device's clock", () => {
    expect(formatCalEventCheckInTime("2026-10-09T18:05:00.000Z")).toBe("6:05 PM");
  });
});

describe("getCalEventCheckInAvailability", () => {
  // Starts 14:00 and ends 19:00 UTC, so the door is open from 02:00 that day to 07:00 the next.
  const event = createEvent();

  test("opens 12 hours before the event starts", () => {
    expect(getCalEventCheckInAvailability(event, new Date("2026-10-10T01:59:59.000Z"))).toEqual({
      kind: "not_yet_open",
      opensAt: "2026-10-10T02:00:00.000Z",
    });
    expect(getCalEventCheckInAvailability(event, new Date("2026-10-10T02:00:00.000Z"))).toEqual({
      kind: "open",
      closesAt: "2026-10-11T07:00:00.000Z",
    });
  });

  test("closes 12 hours after the event ends", () => {
    expect(getCalEventCheckInAvailability(event, new Date("2026-10-11T07:00:00.000Z"))).toEqual({
      kind: "open",
      closesAt: "2026-10-11T07:00:00.000Z",
    });
    expect(getCalEventCheckInAvailability(event, new Date("2026-10-11T07:00:01.000Z"))).toEqual({
      kind: "closed",
      closedAt: "2026-10-11T07:00:00.000Z",
    });
  });
});

describe("getCalEventCheckInAvailabilityDelayMs", () => {
  const event = createEvent();
  const delayAt = (iso) => {
    const now = new Date(iso);
    return getCalEventCheckInAvailabilityDelayMs(getCalEventCheckInAvailability(event, now), now);
  };

  test("waits until the window opens, then until it closes", () => {
    expect(delayAt("2026-10-10T01:00:00.000Z")).toBe(60 * 60 * 1000 + 1);
    expect(delayAt("2026-10-11T06:00:00.000Z")).toBe(60 * 60 * 1000 + 1);
  });

  test("lands on the side of each boundary where the availability has changed", () => {
    const now = new Date("2026-10-10T01:00:00.000Z");
    const opensIn = delayAt(now.toISOString());
    const later = new Date(now.getTime() + opensIn);
    expect(getCalEventCheckInAvailability(event, later).kind).toBe("open");

    const closing = new Date("2026-10-11T06:00:00.000Z");
    const closed = new Date(closing.getTime() + delayAt(closing.toISOString()));
    expect(getCalEventCheckInAvailability(event, closed).kind).toBe("closed");
  });

  test("stops once the window has closed", () => {
    expect(delayAt("2026-10-11T07:00:01.000Z")).toBeNull();
  });

  test("caps the wait at the longest delay setTimeout takes", () => {
    expect(delayAt("2026-01-01T00:00:00.000Z")).toBe(2 ** 31 - 1);
  });
});

describe("getCalEventCheckInWindowNotice", () => {
  test("says when check-in opens or closed, in the event's timezone", () => {
    expect(
      getCalEventCheckInWindowNotice(
        { kind: "not_yet_open", opensAt: "2026-10-10T02:00:00.000Z" },
        "Europe/Berlin"
      )
    ).toBe("Check-in opens Sat, Oct 10, 4:00 AM");
    expect(
      getCalEventCheckInWindowNotice(
        { kind: "closed", closedAt: "2026-10-11T07:00:00.000Z" },
        "Europe/Berlin"
      )
    ).toBe("Check-in closed Sun, Oct 11, 9:00 AM");
  });

  test("says nothing while check-in is open", () => {
    expect(
      getCalEventCheckInWindowNotice(
        { kind: "open", closesAt: "2026-10-11T07:00:00.000Z" },
        "Europe/Berlin"
      )
    ).toBeNull();
  });
});

describe("isCalEventCheckInTokenShaped", () => {
  test("takes the API's 1-256 characters", () => {
    expect(isCalEventCheckInTokenShaped("short.signature")).toBe(true);
    expect(isCalEventCheckInTokenShaped("x".repeat(256))).toBe(true);
    expect(isCalEventCheckInTokenShaped("")).toBe(false);
    expect(isCalEventCheckInTokenShaped("x".repeat(257))).toBe(false);
  });
});

describe("getCalEventTicketCheckInErrorMessage", () => {
  const apiError = (status, reason) =>
    new ApiRequestError(status, `API Error: ${status} ${reason}`);

  test("calls a 404 an invalid ticket, as the web does", () => {
    expect(getCalEventTicketCheckInErrorMessage(apiError(404, "Registration not found"))).toBe(
      CAL_EVENT_INVALID_TICKET_MESSAGE
    );
  });

  test("reads any other failure as a tap's would", () => {
    expect(
      getCalEventTicketCheckInErrorMessage(
        apiError(400, "Check-in is closed outside the event window")
      )
    ).toBe("Check-in is closed outside the event window");
    expect(getCalEventTicketCheckInErrorMessage(apiError(429, "Too many requests"))).toMatch(
      /Wait a moment/
    );
    expect(getCalEventTicketCheckInErrorMessage(new Error("Network request failed"))).toBe(
      "Check your connection and try again."
    );
  });
});

describe("createCalEventScanGate", () => {
  function setup() {
    let clock = 0;
    const gate = createCalEventScanGate(3000, () => clock);
    const advance = (ms) => {
      clock += ms;
    };
    return { gate, advance };
  }

  test("sends one code at a time, so two tickets in frame can't flood the API", () => {
    const { gate } = setup();

    expect(gate.take("a")).toBe(true);
    expect(gate.take("b")).toBe(false);
    expect(gate.take("a")).toBe(false);

    gate.settle("a");
    expect(gate.take("b")).toBe(true);
  });

  test("holds a code for 3 s after its answer, however long the answer took", () => {
    const { gate, advance } = setup();
    gate.take("a");
    advance(5000);
    gate.settle("a");

    advance(2999);
    expect(gate.take("a")).toBe(false);
    advance(1);
    expect(gate.take("a")).toBe(true);
  });

  test("holds each code on its own while others alternate with it", () => {
    const { gate, advance } = setup();
    gate.take("a");
    gate.settle("a");
    gate.take("b");
    gate.settle("b");

    advance(1000);
    expect(gate.take("a")).toBe(false);
    expect(gate.take("b")).toBe(false);
    expect(gate.take("c")).toBe(true);
  });
});
