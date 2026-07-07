import { describe, expect, test } from "@jest/globals";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";
import * as bookingCache from "@/utils/booking-cache";
import {
  bookingMatchesListFilters,
  getBookingForCacheUpdate,
  updateBookingCaches,
  updateBookingListForFilters,
} from "@/utils/booking-cache";

const futureDate = "2026-12-01T10:00:00.000Z";
const futureEndDate = "2026-12-01T10:30:00.000Z";
const pastDate = "2026-01-01T10:00:00.000Z";
const pastEndDate = "2026-01-01T10:30:00.000Z";
const now = new Date("2026-06-11T00:00:00.000Z");

function booking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Demo booking",
    startTime: futureDate,
    endTime: futureEndDate,
    status: "pending",
    ...overrides,
  };
}

describe("booking cache list helpers", () => {
  test("moves a confirmed future booking out of unconfirmed and into upcoming", () => {
    const pendingBooking = booking({ status: "pending" });
    const confirmedBooking = booking({ status: "accepted", eventTypeId: 11 });

    expect(
      updateBookingListForFilters(
        [pendingBooking],
        confirmedBooking,
        {
          status: ["unconfirmed"],
          limit: 50,
        },
        now
      )
    ).toEqual([]);

    expect(
      updateBookingListForFilters(
        [],
        confirmedBooking,
        {
          status: ["upcoming"],
          limit: 50,
        },
        now
      )
    ).toEqual([confirmedBooking]);
  });

  test("treats accepted requires-confirmation bookings as upcoming, not unconfirmed", () => {
    const confirmedBooking = booking({ status: "accepted", requiresConfirmation: true });

    expect(
      bookingMatchesListFilters(
        confirmedBooking,
        {
          status: ["unconfirmed"],
        },
        now
      )
    ).toBe(false);

    expect(
      bookingMatchesListFilters(
        confirmedBooking,
        {
          status: ["upcoming"],
        },
        now
      )
    ).toBe(true);
  });

  test("moves a rejected booking out of unconfirmed and into cancelled-style lists", () => {
    const pendingBooking = booking({ status: "pending" });
    const rejectedBooking = booking({ status: "rejected", rejectionReason: "Unavailable" });

    expect(
      updateBookingListForFilters(
        [pendingBooking],
        rejectedBooking,
        {
          status: ["unconfirmed"],
        },
        now
      )
    ).toEqual([]);

    expect(
      updateBookingListForFilters(
        [],
        rejectedBooking,
        {
          status: ["cancelled"],
        },
        now
      )
    ).toEqual([rejectedBooking]);
  });

  test("keeps existing list-only fields when replacing a cached booking", () => {
    const cachedBooking = booking({
      status: "pending",
      eventType: { id: 11, slug: "intro", title: "Intro call" },
    });
    const confirmedBooking = booking({ status: "accepted", eventTypeId: 11 });

    expect(
      updateBookingListForFilters(
        [cachedBooking],
        confirmedBooking,
        {
          status: ["upcoming"],
        },
        now
      )
    ).toEqual([
      {
        ...cachedBooking,
        ...confirmedBooking,
        eventType: cachedBooking.eventType,
      },
    ]);
  });

  test("matches date and event type filters before inserting", () => {
    const filteredBooking = booking({ status: "accepted", eventTypeId: 22 });

    expect(
      bookingMatchesListFilters(
        filteredBooking,
        {
          status: ["upcoming"],
          eventTypeId: 11,
        },
        now
      )
    ).toBe(false);

    expect(
      bookingMatchesListFilters(
        booking({ status: "accepted", startTime: pastDate, endTime: pastEndDate }),
        {
          status: ["past"],
          eventTypeId: undefined,
        },
        now
      )
    ).toBe(true);
  });

  test("prefers cached detail over stale fallback when navigating back", () => {
    const queryClient = new QueryClient();
    const pendingBooking = booking({ status: "pending", requiresConfirmation: true });
    const confirmedBooking = booking({ status: "accepted", requiresConfirmation: true });

    queryClient.setQueryData(queryKeys.bookings.detail(pendingBooking.uid), pendingBooking);
    updateBookingCaches(queryClient, confirmedBooking);

    expect(getBookingForCacheUpdate(queryClient, pendingBooking.uid, pendingBooking)).toEqual(
      confirmedBooking
    );
  });

  test("syncs mutation results immediately and invalidates bookings for server reconciliation", () => {
    const queryClient = new QueryClient();
    const pendingBooking = booking({ status: "pending" });
    const confirmedBooking = booking({ status: "accepted" });
    const invalidations = [];

    queryClient.invalidateQueries = (filters) => {
      invalidations.push(filters);
      return Promise.resolve();
    };

    queryClient.setQueryData(queryKeys.bookings.detail(pendingBooking.uid), pendingBooking);

    expect(typeof bookingCache.syncBookingCachesAfterMutation).toBe("function");
    bookingCache.syncBookingCachesAfterMutation(queryClient, confirmedBooking);

    expect(queryClient.getQueryData(queryKeys.bookings.detail(pendingBooking.uid))).toEqual(
      confirmedBooking
    );
    expect(invalidations).toContainEqual({ queryKey: queryKeys.bookings.all });
  });
});
