import { describe, expect, test } from "@jest/globals";
import { groupRecurringBookings, searchBookings } from "./bookings-utils";

function createRecurringBooking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Demo booking",
    status: "accepted",
    startTime: "2099-06-12T10:00:00.000Z",
    endTime: "2099-06-12T10:30:00.000Z",
    recurringBookingUid: "recurring-1",
    ...overrides,
  };
}

describe("groupRecurringBookings", () => {
  test("does not mark accepted requires-confirmation bookings as unconfirmed", () => {
    const groups = groupRecurringBookings([
      createRecurringBooking({
        requiresConfirmation: true,
      }),
    ]);

    expect(groups[0]?.hasUnconfirmed).toBe(false);
  });

  test("marks requires_confirmation recurring bookings as unconfirmed", () => {
    const groups = groupRecurringBookings([
      createRecurringBooking({
        status: "requires_confirmation",
      }),
    ]);

    expect(groups[0]?.hasUnconfirmed).toBe(true);
  });
});

describe("searchBookings", () => {
  const bookings = [
    {
      id: 1,
      title: "Intro call",
      status: "accepted",
      attendees: [{ name: "Ada Lovelace", email: "ada@example.com" }],
    },
    {
      id: 2,
      title: "Design review",
      status: "accepted",
      attendees: [{ name: "Grace Hopper", email: "grace@example.com" }],
    },
  ];

  test("returns every booking for a blank query", () => {
    expect(searchBookings(bookings, "   ")).toEqual(bookings);
  });

  test("matches a query that has a trailing space", () => {
    expect(searchBookings(bookings, "ada@example.com ").map((b) => b.id)).toEqual([1]);
  });

  test("matches a query that has a leading space", () => {
    expect(searchBookings(bookings, " design review").map((b) => b.id)).toEqual([2]);
  });

  test("keeps spaces inside the query", () => {
    expect(searchBookings(bookings, "intro call").map((b) => b.id)).toEqual([1]);
  });
});
