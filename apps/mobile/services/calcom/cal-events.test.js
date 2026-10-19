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

const { createCalEvent, getCalEvent, getCalEvents } = require("./cal-events");
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
