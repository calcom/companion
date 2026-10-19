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

const { restoreCalEventLists, setCalEventCover, setCalEventDetail } = require("./useCalEvents");

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

describe("setCalEventDetail for a new draft", () => {
  test("seeds the detail the create screen opens on, though no listing holds it yet", () => {
    const queryClient = new QueryClient();
    const draft = createEvent({ status: "draft" });

    setCalEventDetail(queryClient, draft);

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1"))).toEqual(draft);
  });
});

describe("setCalEventCover", () => {
  test("shows a saved cover on the detail screen, even if the edit saved after it fails", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.calEvents.detail("event-1"), createEvent());

    setCalEventCover(queryClient, "event-1", "https://cdn.example/cover.png");

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1"))).toEqual(
      createEvent({ coverImageUrl: "https://cdn.example/cover.png" })
    );
  });

  test("clears a removed cover", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      queryKeys.calEvents.detail("event-1"),
      createEvent({ coverImageUrl: "https://cdn.example/cover.png" })
    );

    setCalEventCover(queryClient, "event-1", null);

    expect(
      queryClient.getQueryData(queryKeys.calEvents.detail("event-1")).coverImageUrl
    ).toBeNull();
  });

  test("leaves an uncached event alone rather than caching a partial one", () => {
    const queryClient = new QueryClient();

    setCalEventCover(queryClient, "event-1", "https://cdn.example/cover.png");

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1"))).toBeUndefined();
  });
});
