import { describe, expect, test } from "@jest/globals";
import {
  getBookingRequestActionState,
  getBookingRequestBulkActionState,
  isBookingRequestPending,
} from "@/utils/booking-request-actions";

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
      showPendingHostConfirmation: false,
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
      showPendingHostConfirmation: false,
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
      showPendingHostConfirmation: false,
    });
  });

  test("does not treat accepted requires-confirmation bookings as pending requests", () => {
    const booking = createBooking({
      status: "accepted",
      requiresConfirmation: true,
    });

    expect(isBookingRequestPending(booking)).toBe(false);
    expect(
      getBookingRequestActionState({
        booking,
        currentUserId: 42,
        currentUserEmail: "organizer@example.com",
        now,
      })
    ).toEqual({
      canConfirm: false,
      canReject: false,
      showPendingHostConfirmation: false,
    });
  });

  test("keeps recurring confirm-all hidden when any request cannot be confirmed", () => {
    const pendingPaymentBooking = createBooking({
      uid: "booking-with-pending-payment",
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
      getBookingRequestBulkActionState({
        bookings: [pendingPaymentBooking],
        currentUserId: 42,
        currentUserEmail: "organizer@example.com",
        now,
      })
    ).toEqual({
      canConfirmAll: false,
      canRejectAll: true,
      showPendingHostConfirmation: false,
    });
  });

  test("shows pending host confirmation when the current user cannot respond to the request", () => {
    const booking = createBooking({
      attendees: [
        {
          id: 7,
          email: "attendee@example.com",
          name: "Attendee",
        },
      ],
    });

    expect(
      getBookingRequestActionState({
        booking,
        currentUserId: 7,
        currentUserEmail: "attendee@example.com",
        now,
      })
    ).toEqual({
      canConfirm: false,
      canReject: false,
      showPendingHostConfirmation: true,
    });
  });
});
