import { describe, expect, test } from "@jest/globals";
import { getGuestsNotInAttendees, groupRecurringBookings } from "./bookings-utils";

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
