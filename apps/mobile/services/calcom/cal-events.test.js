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
