import { beforeEach, describe, expect, jest, test } from "@jest/globals";

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
  checkInCalEventGuest,
  getCalEvent,
  getCalEventGuests,
  getCalEvents,
  undoCalEventGuestCheckIn,
} = require("./cal-events");
const { ApiRequestError } = require("./request");

describe("getCalEvents", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({ status: "success", data: [] });
  });

  test("lists the user's own events without a team", async () => {
    await getCalEvents(null);
    expect(mockMakeRequest).toHaveBeenCalledWith("/events", {}, "2024-06-14");
  });

  test("lists a team's events from the team route, since /events ignores teamId", async () => {
    await getCalEvents(7);
    expect(mockMakeRequest).toHaveBeenCalledWith("/teams/7/events", {}, "2024-06-14");
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

function createBooking(overrides = {}) {
  return {
    type: "event",
    registrationId: "0199a1b2-0000-7000-8000-000000000001",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phoneNumber: null,
    rsvpResponse: "YES",
    responses: { note: "Vegetarian" },
    locationId: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    checkedInAt: null,
    checkedInByUserId: null,
    ...overrides,
  };
}

function createRegistration(overrides = {}) {
  const { registrationId, type: _type, ...rest } = createBooking();
  return { id: registrationId, status: "CONFIRMED", ...rest, ...overrides };
}

describe("getCalEventGuests", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  test("reads the first page of the event's bookings, as large as the API allows", async () => {
    await getCalEventGuests("event-uuid");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/bookings?limit=250",
      {},
      "2024-06-14"
    );
  });

  test("keeps only what the check-in list shows, keyed by the registration id", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [
        createBooking(),
        createBooking({
          registrationId: "0199a1b2-0000-7000-8000-000000000002",
          name: "Grace Hopper",
          email: "grace@example.com",
          phoneNumber: "+15555550100",
          checkedInAt: "2026-10-09T18:05:00.000Z",
          checkedInByUserId: 7,
        }),
      ],
      pagination: { nextCursor: "eyJzb3J0VXVpZCI6Ii4uLiJ9", hasMore: true },
    });

    await expect(getCalEventGuests("event-uuid")).resolves.toEqual({
      guests: [
        {
          id: "0199a1b2-0000-7000-8000-000000000001",
          name: "Ada Lovelace",
          email: "ada@example.com",
          phoneNumber: null,
          checkedInAt: null,
        },
        {
          id: "0199a1b2-0000-7000-8000-000000000002",
          name: "Grace Hopper",
          email: "grace@example.com",
          phoneNumber: "+15555550100",
          checkedInAt: "2026-10-09T18:05:00.000Z",
        },
      ],
      hasMore: true,
    });
  });

  test("reads the optional fields the API may leave out as null", async () => {
    const { phoneNumber: _phone, checkedInAt: _checkedInAt, ...booking } = createBooking();
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [booking],
      pagination: { nextCursor: null, hasMore: false },
    });

    const { guests } = await getCalEventGuests("event-uuid");

    expect(guests[0]).toMatchObject({ phoneNumber: null, checkedInAt: null });
  });

  test("rethrows a failure, so the screen can tell a 404 from a dropped connection", async () => {
    const error = new ApiRequestError(404, "API Error: 404 Event not found");
    mockMakeRequest.mockRejectedValue(error);
    await expect(getCalEventGuests("event-uuid")).rejects.toBe(error);
  });
});

describe("checkInCalEventGuest", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("posts to the registration's check-in", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: {
        kind: "checked_in",
        registration: createRegistration({ checkedInAt: "2026-10-09T18:05:00.000Z" }),
      },
    });

    await expect(checkInCalEventGuest("event-uuid", "registration-id")).resolves.toEqual({
      kind: "checked_in",
      checkedInAt: "2026-10-09T18:05:00.000Z",
    });
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/registration-id/check-in",
      { method: "POST" },
      "2024-06-14"
    );
  });

  test("reports when someone checked the guest in first", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: {
        kind: "already_checked_in",
        registration: createRegistration({ checkedInAt: "2026-10-09T18:05:00.000Z" }),
        checkedInAt: "2026-10-09T18:05:00.000Z",
      },
    });

    await expect(checkInCalEventGuest("event-uuid", "registration-id")).resolves.toEqual({
      kind: "already_checked_in",
      checkedInAt: "2026-10-09T18:05:00.000Z",
    });
  });

  test("reports a guest who is no longer confirmed", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { kind: "not_confirmed", status: "CANCELLED" },
    });

    await expect(checkInCalEventGuest("event-uuid", "registration-id")).resolves.toEqual({
      kind: "not_confirmed",
    });
  });

  test("rethrows the API's refusal outside the check-in window", async () => {
    const error = new ApiRequestError(
      400,
      "API Error: 400 Check-in is closed outside the event window"
    );
    mockMakeRequest.mockRejectedValue(error);
    await expect(checkInCalEventGuest("event-uuid", "registration-id")).rejects.toBe(error);
  });
});

describe("undoCalEventGuestCheckIn", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({ status: "success", data: { kind: "not_checked_in" } });
  });

  test("deletes the registration's check-in", async () => {
    await undoCalEventGuestCheckIn("event-uuid", "registration-id");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/registrations/registration-id/check-in",
      { method: "DELETE" },
      "2024-06-14"
    );
  });
});
