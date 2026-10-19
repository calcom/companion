import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const mockMakeRequest = jest.fn();
jest.mock("./request", () => ({
  // Same shape as the real class, without loading request.ts and its native networking.
  ApiRequestError: class ApiRequestError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
  makeRequest: (...args) => mockMakeRequest(...args),
}));

const {
  addCalEventLocation,
  approveAllCalEventRegistrations,
  approveCalEventRegistration,
  createCalEvent,
  declineCalEventRegistration,
  deleteCalEventCoverImage,
  getCalEvent,
  getCalEventMessages,
  getCalEventRegistrationCounts,
  getCalEventRoster,
  getCalEvents,
  inviteCalEventGuests,
  removeCalEventLocation,
  reorderCalEventCoHosts,
  sendCalEventMessage,
  updateCalEvent,
  updateCalEventLocation,
  uploadCalEventCoverImage,
  uploadCalEventPersonAvatar,
} = require("./cal-events");
const { ApiRequestError } = require("./request");

function createApiEvent(overrides = {}) {
  return {
    uuid: "event-1",
    slug: "meetup",
    title: "Meetup",
    startTime: "2030-01-01T18:00:00.000Z",
    endTime: "2030-01-01T20:00:00.000Z",
    timeZone: "UTC",
    publishedAt: "2029-12-01T00:00:00.000Z",
    cancelledAt: null,
    locations: [],
    hosts: [],
    ...overrides,
  };
}

describe("getCalEvents", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  test("asks for the first page of a group of the user's own events, on the cursor-paginated version", async () => {
    await getCalEvents(null, "draft");
    expect(mockMakeRequest).toHaveBeenCalledWith("/events?status=draft&limit=25", {}, "2026-05-01");
  });

  test("lists a team's events from the team route, since /events ignores teamId", async () => {
    await getCalEvents(7, "upcoming");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/teams/7/events?status=upcoming&limit=25",
      {},
      "2026-05-01"
    );
  });

  test("passes the cursor for a later page of the same group", async () => {
    await getCalEvents(7, "past", "eyJ2IjoyfQ");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/teams/7/events?status=past&limit=25&cursor=eyJ2IjoyfQ",
      {},
      "2026-05-01"
    );
  });

  test("returns the page's events with the cursor to the next one", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createApiEvent()],
      pagination: { nextCursor: "next-page", hasMore: true },
    });

    const page = await getCalEvents(null, "upcoming");

    expect(page.events.map((event) => event.uuid)).toEqual(["event-1"]);
    expect(page.events[0].publicUrl).toBe("https://example.test/meetup");
    expect(page).toMatchObject({ status: "upcoming", nextCursor: "next-page", hasMore: true });
  });

  test("ends the listing on the last page", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createApiEvent()],
      pagination: { nextCursor: null, hasMore: false },
    });
    await expect(getCalEvents(null, "upcoming")).resolves.toMatchObject({
      nextCursor: null,
      hasMore: false,
    });
  });

  test("ends the listing when there is no cursor to ask for more with", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createApiEvent()],
      pagination: { nextCursor: null, hasMore: true },
    });
    await expect(getCalEvents(null, "upcoming")).resolves.toMatchObject({ hasMore: false });
  });

  test("ends the listing when the response has no pagination", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: [createApiEvent()] });
    await expect(getCalEvents(null, "upcoming")).resolves.toMatchObject({
      nextCursor: null,
      hasMore: false,
    });
  });
});

describe("getCalEvent", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("resolves to null when the API answers 404", async () => {
    mockMakeRequest.mockRejectedValue(new ApiRequestError(404, "API Error: 404 Event not found"));
    await expect(getCalEvent("event-uuid")).resolves.toBeNull();
  });

  test("rethrows any other failure", async () => {
    const error = new ApiRequestError(500, "API Error: 500 Internal server error");
    mockMakeRequest.mockRejectedValue(error);
    await expect(getCalEvent("event-uuid")).rejects.toBe(error);
  });
});

describe("createCalEvent", () => {
  const input = {
    title: "Rooftop meetup",
    startTime: "2026-10-20T17:00:00.000Z",
    endTime: "2026-10-20T19:00:00.000Z",
    timeZone: "Europe/Madrid",
    visibility: "PUBLIC",
    requiresApproval: false,
  };
  const created = {
    uuid: "event-uuid",
    slug: "rooftop-meetup",
    title: "Rooftop meetup",
    endTime: "2026-10-20T19:00:00.000Z",
    publishedAt: null,
    cancelledAt: null,
    locations: [{ type: "address", address: "Calle Mayor 1" }],
  };

  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({ status: "success", data: created });
  });

  test("creates a personal event on /events", async () => {
    await createCalEvent(input, null);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "2024-06-14"
    );
  });

  test("creates a team's event on the team route", async () => {
    await createCalEvent(input, 7);
    expect(mockMakeRequest.mock.calls[0][0]).toBe("/teams/7/events");
  });

  test("returns the draft with what the app derives from it", async () => {
    const event = await createCalEvent(input, null);
    expect(event).toMatchObject({
      uuid: "event-uuid",
      status: "draft",
      locationAddress: "Calle Mayor 1",
      publicUrl: "https://example.test/rooftop-meetup",
    });
  });

  test("fails on a response without the event", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await expect(createCalEvent(input, null)).rejects.toThrow("Invalid response");
  });
});

describe("updateCalEvent", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: {
        uuid: "event-uuid",
        slug: "rooftop-meetup",
        title: "Renamed",
        endTime: "2026-10-20T19:00:00.000Z",
        publishedAt: null,
        cancelledAt: null,
        locations: [],
      },
    });
  });

  test("patches only the given fields", async () => {
    const event = await updateCalEvent("event-uuid", { title: "Renamed", capacity: null });
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed", capacity: null }),
      },
      "2024-06-14"
    );
    expect(event).toMatchObject({ title: "Renamed", status: "draft" });
  });
});

describe("event media and locations", () => {
  const file = { uri: "file:///cover.jpg", name: "cover.jpg", type: "image/jpeg" };
  // Node's FormData stringifies React Native's { uri, name, type } file part, so .get("file")
  // can't show it. Watch what gets appended instead.
  let appendSpy;

  beforeEach(() => {
    mockMakeRequest.mockReset();
    appendSpy = jest.spyOn(FormData.prototype, "append");
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  test("adds a location with a POST of that one location", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: { id: "l2", type: "link" } });
    const location = { type: "link", link: "https://zoom.us/j/1", label: "Stream" };
    await addCalEventLocation("event-uuid", location);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/locations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      },
      "2024-06-14"
    );
  });

  test("edits a location with a PATCH of what changed", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: { id: "l2", type: "link" } });
    const patch = { type: "link", label: null };
    await updateCalEventLocation("event-uuid", "l2", patch);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/locations/l2",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
      "2024-06-14"
    );
  });

  test("removes a location and returns the ones left", async () => {
    const remaining = [{ id: "l1", type: "address", address: "Plaza 1" }];
    mockMakeRequest.mockResolvedValue({ status: "success", data: remaining });
    await expect(removeCalEventLocation("event-uuid", "l2")).resolves.toEqual(remaining);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/locations/l2",
      { method: "DELETE" },
      "2024-06-14"
    );
  });

  test("uploads the cover as multipart, without a JSON content type", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { coverImageUrl: "https://x/c.jpg" },
    });
    await expect(uploadCalEventCoverImage("event-uuid", file)).resolves.toBe("https://x/c.jpg");
    const [endpoint, options] = mockMakeRequest.mock.calls[0];
    expect(endpoint).toBe("/events/event-uuid/cover-image");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith("file", file);
    expect(appendSpy.mock.contexts[0]).toBe(options.body);
  });

  test("removes the cover with a DELETE", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await deleteCalEventCoverImage("event-uuid");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/cover-image",
      { method: "DELETE" },
      "2024-06-14"
    );
  });

  test("uploads a person's photo as multipart and resolves to its URL", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { avatarUrl: "https://x/a.jpg" },
    });
    await expect(uploadCalEventPersonAvatar("event-uuid", file)).resolves.toBe("https://x/a.jpg");
    const [endpoint, options] = mockMakeRequest.mock.calls[0];
    expect(endpoint).toBe("/events/event-uuid/person-avatar");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith("file", file);
    expect(appendSpy.mock.contexts[0]).toBe(options.body);
  });

  test("reorders co-hosts with every id", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await reorderCalEventCoHosts("event-uuid", ["b", "a"]);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/co-hosts/order",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coHostIds: ["b", "a"] }),
      },
      "2024-06-14"
    );
  });
});

function createBooking(overrides = {}) {
  return {
    type: "event",
    registrationId: "r1",
    name: "Ada",
    email: "ada@example.com",
    phoneNumber: null,
    rsvpResponse: "YES",
    responses: { name: "Ada", email: "ada@example.com", company: "Acme" },
    locationId: null,
    createdAt: "2029-12-02T10:00:00.000Z",
    checkedInAt: null,
    checkedInByUserId: null,
    ...overrides,
  };
}

describe("getCalEventRegistrationCounts", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("reads the event's counts", async () => {
    const counts = {
      pendingApproval: 1,
      waitlisted: 0,
      pendingPayment: 0,
      offerExpired: 0,
      declined: 0,
      cancelled: 0,
      confirmed: 4,
      going: 3,
      checkedIn: 2,
      rsvpResponses: { yes: 4, no: 0, maybe: 1 },
      byLocation: [{ locationId: null, count: 4 }],
    };
    mockMakeRequest.mockResolvedValue({ status: "success", data: counts });
    await expect(getCalEventRegistrationCounts("event-uuid")).resolves.toEqual(counts);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/counts",
      {},
      "2024-06-14"
    );
  });

  test("rejects a response without counts", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await expect(getCalEventRegistrationCounts("event-uuid")).rejects.toThrow(
      "Invalid response from registration counts API"
    );
  });
});

describe("getCalEventRoster", () => {
  const STATUSES =
    "PENDING_APPROVAL%2CWAITLISTED%2CPENDING_PAYMENT%2CCONFIRMED%2CDECLINED%2CCANCELLED";

  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("reads every listed status in pages of 250 and maps each guest", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [
        createBooking({ status: "PENDING_APPROVAL", responses: null, phoneNumber: undefined }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    await expect(getCalEventRoster("event-uuid")).resolves.toEqual([
      {
        registrationId: "r1",
        status: "PENDING_APPROVAL",
        name: "Ada",
        email: "ada@example.com",
        phoneNumber: null,
        rsvpResponse: "YES",
        responses: {},
        locationId: null,
        createdAt: "2029-12-02T10:00:00.000Z",
        checkedInAt: null,
        avatarUrl: null,
        payment: null,
        noShow: false,
        decidedAt: null,
      },
    ]);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      `/events/event-uuid/bookings?limit=250&status=${STATUSES}`,
      {},
      "2024-06-14"
    );
  });

  test("maps a guest's photo, payment, no-show and decision time", async () => {
    const payment = { success: true, refunded: false, amount: 2000, currency: "eur" };
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [
        createBooking({
          avatarUrl: "https://cal.example/avatar.png",
          payment,
          noShow: true,
          decidedAt: "2029-12-03T10:00:00.000Z",
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    await expect(getCalEventRoster("event-uuid")).resolves.toEqual([
      expect.objectContaining({
        avatarUrl: "https://cal.example/avatar.png",
        payment,
        noShow: true,
        decidedAt: "2029-12-03T10:00:00.000Z",
      }),
    ]);
  });

  test("follows the cursor to the end and lists a repeated guest once", async () => {
    mockMakeRequest
      .mockResolvedValueOnce({
        status: "success",
        data: [createBooking({ registrationId: "r1" }), createBooking({ registrationId: "r2" })],
        pagination: { nextCursor: "c2", hasMore: true },
      })
      .mockResolvedValueOnce({
        status: "success",
        data: [createBooking({ registrationId: "r2" }), createBooking({ registrationId: "r3" })],
        pagination: { nextCursor: null, hasMore: false },
      });
    const roster = await getCalEventRoster("event-uuid");
    expect(roster.map((guest) => guest.registrationId)).toEqual(["r1", "r2", "r3"]);
    expect(mockMakeRequest).toHaveBeenLastCalledWith(
      `/events/event-uuid/bookings?limit=250&status=${STATUSES}&cursor=c2`,
      {},
      "2024-06-14"
    );
  });

  test("reads a guest without a status as confirmed, as older servers list only those", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createBooking()],
      pagination: { nextCursor: null, hasMore: false },
    });
    const [guest] = await getCalEventRoster("event-uuid");
    expect(guest.status).toBe("CONFIRMED");
  });

  test("stops when the API hands back a cursor it already followed", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createBooking()],
      pagination: { nextCursor: "same", hasMore: true },
    });
    await expect(getCalEventRoster("event-uuid")).resolves.toHaveLength(1);
    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
  });
});

describe("guest actions", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("invites with the trimmed note, and leaves a blank note out", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: {
        invitedCount: 1,
        skippedAlreadyInvited: 0,
        skippedAlreadyRegistered: 0,
        skippedOnCooldown: 0,
        skippedInvalid: 0,
        failedCount: 0,
      },
    });
    const result = await inviteCalEventGuests("event-uuid", {
      emails: ["a@example.com"],
      hostNote: "  See you  ",
    });
    expect(result.outcomes).toEqual([]);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/invitations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: ["a@example.com"], hostNote: "See you" }),
      },
      "2024-06-14"
    );
    await inviteCalEventGuests("event-uuid", { emails: ["a@example.com"], hostNote: "  " });
    expect(mockMakeRequest.mock.calls[1][1].body).toBe(
      JSON.stringify({ emails: ["a@example.com"] })
    );
  });

  test("sends a message to one group", async () => {
    const sent = {
      id: "m1",
      status: "QUEUED",
      recipientCount: 3,
      textRecipientCount: 0,
      skippedPhoneCount: 0,
    };
    mockMakeRequest.mockResolvedValue({ status: "success", data: sent });
    const input = { segment: "GOING", subject: "Hi", body: "Doors at 6", checkedIn: false };
    await expect(sendCalEventMessage("event-uuid", input)).resolves.toEqual(sent);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "2024-06-14"
    );
  });

  test("lists sent messages a page at a time, with the next cursor only while there are more", async () => {
    const message = { id: "m1", segment: "GOING", status: "SENT" };
    mockMakeRequest.mockResolvedValueOnce({
      status: "success",
      data: [message],
      pagination: { nextCursor: "c2", hasMore: true },
    });
    await expect(getCalEventMessages("event-uuid")).resolves.toEqual({
      messages: [message],
      nextCursor: "c2",
    });
    expect(mockMakeRequest).toHaveBeenCalledWith("/events/event-uuid/messages", {}, "2024-06-14");

    mockMakeRequest.mockResolvedValueOnce({
      status: "success",
      data: [],
      pagination: { nextCursor: "stale", hasMore: false },
    });
    await expect(getCalEventMessages("event-uuid", "c2")).resolves.toEqual({
      messages: [],
      nextCursor: null,
    });
    expect(mockMakeRequest).toHaveBeenLastCalledWith(
      "/events/event-uuid/messages?cursor=c2",
      {},
      "2024-06-14"
    );
  });

  test("approves all with the list's search and location", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { kind: "completed", approvedCount: 4 },
    });
    await expect(
      approveAllCalEventRegistrations("event-uuid", { search: " ada ", locationId: "l1" })
    ).resolves.toEqual({ kind: "completed", approvedCount: 4, notSeatedCount: 0 });
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/approve-all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: "ada", locationId: "l1" }),
      },
      "2024-06-14"
    );
  });

  test("reports a paid event's approval as started", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { kind: "started", operationId: "op", total: 9 },
    });
    await expect(approveAllCalEventRegistrations("event-uuid")).resolves.toEqual({
      kind: "started",
      total: 9,
    });
    expect(mockMakeRequest.mock.calls[0][1].body).toBe("{}");
  });

  test("approves one guest and returns what happened", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { kind: "payment_pending", registration: { id: "r1" } },
    });
    await expect(approveCalEventRegistration("event-uuid", "r1")).resolves.toBe("payment_pending");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/r1/approve",
      { method: "POST" },
      "2024-06-14"
    );
  });

  test("declines one guest", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: { kind: "declined" } });
    await expect(declineCalEventRegistration("event-uuid", "r1")).resolves.toBe("declined");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/r1/decline",
      { method: "POST" },
      "2024-06-14"
    );
  });

  test("rejects a decision response without a kind", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: {} });
    await expect(approveCalEventRegistration("event-uuid", "r1")).rejects.toThrow(
      "Invalid response from approve API"
    );
  });
});
