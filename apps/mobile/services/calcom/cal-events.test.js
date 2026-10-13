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

const { getCalEvent, getCalEvents } = require("./cal-events");
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

  test("asks for the first page of the user's own events, on the cursor-paginated version", async () => {
    await getCalEvents(null);
    expect(mockMakeRequest).toHaveBeenCalledWith("/events?limit=25", {}, "2026-05-01");
  });

  test("lists a team's events from the team route, since /events ignores teamId", async () => {
    await getCalEvents(7);
    expect(mockMakeRequest).toHaveBeenCalledWith("/teams/7/events?limit=25", {}, "2026-05-01");
  });

  test("passes the cursor for a later page", async () => {
    await getCalEvents(7, "eyJ2IjoyfQ");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/teams/7/events?limit=25&cursor=eyJ2IjoyfQ",
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

    const page = await getCalEvents(null);

    expect(page.events.map((event) => event.uuid)).toEqual(["event-1"]);
    expect(page.events[0].publicUrl).toBe("https://example.test/meetup");
    expect(page).toMatchObject({ nextCursor: "next-page", hasMore: true });
  });

  test("ends the listing on the last page", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createApiEvent()],
      pagination: { nextCursor: null, hasMore: false },
    });
    await expect(getCalEvents(null)).resolves.toMatchObject({ nextCursor: null, hasMore: false });
  });

  test("ends the listing when there is no cursor to ask for more with", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: [createApiEvent()],
      pagination: { nextCursor: null, hasMore: true },
    });
    await expect(getCalEvents(null)).resolves.toMatchObject({ hasMore: false });
  });

  test("ends the listing when the response has no pagination", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: [createApiEvent()] });
    await expect(getCalEvents(null)).resolves.toMatchObject({ nextCursor: null, hasMore: false });
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
