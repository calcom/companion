import { describe, expect, test } from "bun:test";
import { getBookingRequestActionState } from "./BookingDetailRequestActions.state";

const now = new Date("2026-06-11T00:00:00.000Z");

function createBooking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Demo booking",
    status: "pending",
    startTime: "2026-06-12T10:00:00.000Z",
    endTime: "2026-06-12T10:30:00.000Z",
    user: {
      id: 42,
      email: "organizer@example.com",
      name: "Organizer",
      timeZone: "UTC",
    },
    ...overrides,
  };
}

describe("getBookingRequestActionState", () => {
  test("allows confirming paid booking requests with a successful on-booking payment row", () => {
    const booking = createBooking({
      payment: [
        {
          id: 1,
          success: true,
          paymentOption: "ON_BOOKING",
          refunded: false,
        },
      ],
    });

    expect(
      getBookingRequestActionState({
        booking,
        currentUserId: 42,
        currentUserEmail: "organizer@example.com",
        now,
      })
    ).toEqual({
      canConfirm: true,
      canReject: true,
    });
  });

  test("keeps confirm hidden while an on-booking payment is pending", () => {
    const booking = createBooking({
      payment: [
        {
          id: 1,
          success: false,
          paymentOption: "ON_BOOKING",
          refunded: false,
        },
      ],
    });

    expect(
      getBookingRequestActionState({
        booking,
        currentUserId: 42,
        currentUserEmail: "organizer@example.com",
        now,
      })
    ).toEqual({
      canConfirm: false,
      canReject: true,
    });
  });

  test("treats requires_confirmation status as a pending booking request", () => {
    const booking = createBooking({
      status: "requires_confirmation",
    });

    expect(
      getBookingRequestActionState({
        booking,
        currentUserId: 42,
        currentUserEmail: "organizer@example.com",
        now,
      })
    ).toEqual({
      canConfirm: true,
      canReject: true,
    });
  });
});
