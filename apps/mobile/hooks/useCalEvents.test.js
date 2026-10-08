import { describe, expect, jest, test } from "@jest/globals";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";

// Only the cache helper is under test: don't load the API client and its native networking.
jest.mock("@/services/calcom", () => ({ CalComAPIService: {} }));
// Same exports as services/calcom/cal-events.test.js mocks: bun shares module mocks across files.
jest.mock("@/services/calcom/request", () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  makeRequest: () => Promise.reject(new Error("not under test")),
}));

const { setCalEventDetail } = require("./useCalEvents");

function createEvent(overrides = {}) {
  return { uuid: "event-1", title: "Meetup", status: "published", ...overrides };
}

describe("setCalEventDetail", () => {
  test("keeps the listing's confirmedCount, which publish/cancel responses leave out", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.calEvents.list(null), [createEvent({ confirmedCount: 12 })]);

    setCalEventDetail(queryClient, createEvent({ status: "cancelled" }));

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1"))).toEqual(
      createEvent({ status: "cancelled", confirmedCount: 12 })
    );
  });

  test("keeps a count the response does carry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.calEvents.list(null), [createEvent({ confirmedCount: 12 })]);

    setCalEventDetail(queryClient, createEvent({ confirmedCount: 13 }));

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1")).confirmedCount).toBe(13);
  });
});
