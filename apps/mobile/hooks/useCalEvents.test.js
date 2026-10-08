import { describe, expect, jest, test } from "@jest/globals";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";

// Only the cache helpers are under test: don't load the API client and its native networking.
let mockAuthGeneration = 1;
jest.mock("@/services/calcom", () => ({
  CalComAPIService: { getAuthGeneration: () => mockAuthGeneration },
}));
// Same exports as services/calcom/cal-events.test.js mocks: bun shares module mocks across files.
jest.mock("@/services/calcom/request", () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  makeRequest: () => Promise.reject(new Error("not under test")),
}));

const { restoreCalEventLists, setCalEventDetail } = require("./useCalEvents");

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

describe("restoreCalEventLists", () => {
  test("puts back the lists a failed delete took the event out of", () => {
    const queryClient = new QueryClient();
    const previous = [[queryKeys.calEvents.list(null), [createEvent()]]];
    queryClient.setQueryData(queryKeys.calEvents.list(null), []);

    restoreCalEventLists(queryClient, { previous, authGeneration: mockAuthGeneration });

    expect(queryClient.getQueryData(queryKeys.calEvents.list(null))).toEqual([createEvent()]);
  });

  test("doesn't bring the lists back after a logout or account switch cleared the cache", () => {
    const queryClient = new QueryClient();
    const previous = [[queryKeys.calEvents.list(null), [createEvent()]]];
    const snapshot = { previous, authGeneration: mockAuthGeneration };
    // What logging out, or in as someone else, does while the delete is in flight.
    mockAuthGeneration += 1;
    queryClient.clear();

    restoreCalEventLists(queryClient, snapshot);

    expect(queryClient.getQueryData(queryKeys.calEvents.list(null))).toBeUndefined();
  });
});
