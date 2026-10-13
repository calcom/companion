import { describe, expect, jest, test } from "@jest/globals";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
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

const {
  flattenCalEventsPages,
  removeCalEventFromPages,
  replaceCalEventInPages,
  restartCalEvents,
  restoreCalEventLists,
  setCalEventDetail,
} = require("./useCalEvents");

function createEvent(overrides = {}) {
  return { uuid: "event-1", title: "Meetup", status: "published", ...overrides };
}

/** A listing as the cache holds it: one page per array, each pointing at the next. */
function createListing(...pages) {
  return {
    pages: pages.map((events, index) => {
      const hasMore = index < pages.length - 1;
      return { events, nextCursor: hasMore ? `cursor-${index + 1}` : null, hasMore };
    }),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index}`)),
  };
}

describe("flattenCalEventsPages", () => {
  test("lists the events of every loaded page in order", () => {
    const listing = createListing(
      [createEvent({ uuid: "a" }), createEvent({ uuid: "b" })],
      [createEvent({ uuid: "c" })]
    );
    expect(flattenCalEventsPages(listing).map((event) => event.uuid)).toEqual(["a", "b", "c"]);
  });

  test("keeps the first copy of an event that two pages both returned", () => {
    const listing = createListing(
      [createEvent({ uuid: "a", title: "First" })],
      [createEvent({ uuid: "a", title: "Second" }), createEvent({ uuid: "b" })]
    );
    expect(flattenCalEventsPages(listing).map((event) => event.title)).toEqual(["First", "Meetup"]);
  });
});

describe("removeCalEventFromPages", () => {
  test("takes the event off whichever page held it and keeps the cursors", () => {
    const listing = createListing(
      [createEvent({ uuid: "a" })],
      [createEvent({ uuid: "b" }), createEvent({ uuid: "c" })]
    );

    const result = removeCalEventFromPages(listing, "b");

    expect(result.pages.map((page) => page.events.map((event) => event.uuid))).toEqual([
      ["a"],
      ["c"],
    ]);
    expect(result.pages.map((page) => page.nextCursor)).toEqual(["cursor-1", null]);
    expect(result.pageParams).toEqual(listing.pageParams);
  });
});

describe("replaceCalEventInPages", () => {
  test("puts a publish/cancel response on a later page, keeping the listed confirmedCount", () => {
    const listing = createListing(
      [createEvent({ uuid: "a" })],
      [createEvent({ uuid: "b", status: "draft", confirmedCount: 4 })]
    );

    const result = replaceCalEventInPages(listing, createEvent({ uuid: "b" }));

    expect(result.pages[1].events).toEqual([createEvent({ uuid: "b", confirmedCount: 4 })]);
    expect(result.pages[0]).toEqual(listing.pages[0]);
  });
});

describe("setCalEventDetail", () => {
  test("keeps the listing's confirmedCount, which publish/cancel responses leave out", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      queryKeys.calEvents.list(null),
      createListing([createEvent({ confirmedCount: 12 })])
    );

    setCalEventDetail(queryClient, createEvent({ status: "cancelled" }));

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1"))).toEqual(
      createEvent({ status: "cancelled", confirmedCount: 12 })
    );
  });

  test("finds the count on a later page of a team's listing", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      queryKeys.calEvents.list(7),
      createListing([createEvent({ uuid: "other" })], [createEvent({ confirmedCount: 3 })])
    );

    setCalEventDetail(queryClient, createEvent({ status: "cancelled" }));

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1")).confirmedCount).toBe(3);
  });

  test("keeps a count the response does carry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      queryKeys.calEvents.list(null),
      createListing([createEvent({ confirmedCount: 12 })])
    );

    setCalEventDetail(queryClient, createEvent({ confirmedCount: 13 }));

    expect(queryClient.getQueryData(queryKeys.calEvents.detail("event-1")).confirmedCount).toBe(13);
  });
});

describe("restoreCalEventLists", () => {
  test("puts back the lists a failed delete took the event out of", () => {
    const queryClient = new QueryClient();
    const listing = createListing([createEvent({ uuid: "a" })], [createEvent()]);
    const previous = [[queryKeys.calEvents.list(null), listing]];
    queryClient.setQueryData(
      queryKeys.calEvents.list(null),
      removeCalEventFromPages(listing, "event-1")
    );

    restoreCalEventLists(queryClient, { previous, authGeneration: mockAuthGeneration });

    expect(queryClient.getQueryData(queryKeys.calEvents.list(null))).toEqual(listing);
  });

  test("doesn't bring the lists back after a logout or account switch cleared the cache", () => {
    const queryClient = new QueryClient();
    const previous = [[queryKeys.calEvents.list(null), createListing([createEvent()])]];
    const snapshot = { previous, authGeneration: mockAuthGeneration };
    // What logging out, or in as someone else, does while the delete is in flight.
    mockAuthGeneration += 1;
    queryClient.clear();

    restoreCalEventLists(queryClient, snapshot);

    expect(queryClient.getQueryData(queryKeys.calEvents.list(null))).toBeUndefined();
  });
});

describe("restartCalEvents", () => {
  test("refetches only the first page instead of every page loaded", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryFn = jest.fn(async ({ pageParam }) => ({
      events: [createEvent({ uuid: pageParam ?? "first" })],
      nextCursor: "cursor-1",
      hasMore: true,
    }));
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: queryKeys.calEvents.list(7),
      queryFn,
      initialPageParam: null,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    await observer.fetchNextPage();
    expect(queryClient.getQueryData(queryKeys.calEvents.list(7)).pages).toHaveLength(2);
    queryFn.mockClear();

    await restartCalEvents(queryClient, 7);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0][0].pageParam).toBeNull();
    const listing = queryClient.getQueryData(queryKeys.calEvents.list(7));
    expect(listing.pages).toHaveLength(1);
    expect(listing.pageParams).toEqual([null]);
    unsubscribe();
  });
});
