import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const mockMakeRequest = jest.fn();
jest.mock("./request", () => ({
  makeRequest: (...args) => mockMakeRequest(...args),
}));

const { getCalEvents } = require("./cal-events");

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
