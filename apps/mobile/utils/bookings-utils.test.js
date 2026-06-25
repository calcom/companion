import { describe, expect, test } from "bun:test";
import { groupRecurringBookings } from "./bookings-utils";

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
