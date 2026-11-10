import { describe, expect, test } from "@jest/globals";
import {
  getBookingStartTime,
  getGuestsNotInAttendees,
  groupBookingsByMonth,
  groupRecurringBookings,
  sortBookingsByStart,
} from "./bookings-utils";

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

describe("getGuestsNotInAttendees", () => {
  test("leaves out a guest who is also an attendee, whatever the case", () => {
    const guests = getGuestsNotInAttendees({
      attendees: [{ email: "Guest@Mailinator.com", name: "Guest" }],
      guests: ["guest@mailinator.com", "other@mailinator.com"],
    });

    expect(guests).toEqual(["other@mailinator.com"]);
  });

  test("returns no guests when the booking has none", () => {
    expect(getGuestsNotInAttendees({ attendees: [{ email: "a@mailinator.com" }] })).toEqual([]);
  });
});

describe("sortBookingsByStart", () => {
  // API v2 bookings carry `start` only, as the Past list receives them.
  const past = [
    { id: 1, start: "2026-08-20T10:00:00.000Z" },
    { id: 2, start: "2026-09-02T10:00:00.000Z" },
    { id: 3, start: "2026-08-05T10:00:00.000Z" },
    { id: 4, start: "2026-09-15T10:00:00.000Z" },
  ];

  test("reads `start` when there's no `startTime`", () => {
    expect(getBookingStartTime({ start: "2026-08-20T10:00:00.000Z" })).toBe(
      "2026-08-20T10:00:00.000Z"
    );
    expect(getBookingStartTime({ startTime: "2026-08-21T10:00:00.000Z" })).toBe(
      "2026-08-21T10:00:00.000Z"
    );
  });

  test("puts past bookings latest first, and upcoming ones soonest first", () => {
    expect(sortBookingsByStart(past, "desc").map((b) => b.id)).toEqual([4, 2, 1, 3]);
    expect(sortBookingsByStart(past, "asc").map((b) => b.id)).toEqual([3, 1, 2, 4]);
  });

  test("gives each month one header, so list keys stay unique", () => {
    const items = groupBookingsByMonth(sortBookingsByStart(past, "desc"));
    const keys = items.map((item) => item.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(items.filter((item) => item.type === "monthHeader")).toHaveLength(2);
  });
});
