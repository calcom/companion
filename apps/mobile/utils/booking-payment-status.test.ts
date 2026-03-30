import { describe, expect, it } from "bun:test";

import type { Booking } from "../services/types/bookings.types";

import {
  getBookingPaymentStatus,
  recurringGroupHasPendingPayment,
} from "./booking-payment-status";

/** Minimal booking stub — only the fields the helper inspects. */
function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    uid: "test-uid",
    title: "Test Booking",
    startTime: "2026-03-30T10:00:00Z",
    endTime: "2026-03-30T11:00:00Z",
    status: "accepted",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getBookingPaymentStatus
// ---------------------------------------------------------------------------
describe("getBookingPaymentStatus", () => {
  // -- No payment rows -------------------------------------------------
  it("returns no badge when payment array is missing", () => {
    const result = getBookingPaymentStatus(makeBooking());
    expect(result.isPaymentCompleted).toBe(false);
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  it("returns no badge when payment array is empty", () => {
    const result = getBookingPaymentStatus(makeBooking({ payment: [] }));
    expect(result.isPaymentCompleted).toBe(false);
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  // -- Pending payment (ON_BOOKING, unpaid) -----------------------------
  it("returns isPendingPayment for unpaid ON_BOOKING payment", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        status: "pending",
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPaymentCompleted).toBe(false);
    expect(result.isPendingPayment).toBe(true);
    expect(result.paymentBadgeText).toBe("Pending payment");
  });

  it("returns isPendingPayment for accepted booking with failed ON_BOOKING payment", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        status: "accepted",
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPendingPayment).toBe(true);
    expect(result.paymentBadgeText).toBe("Pending payment");
  });

  // -- Paid booking (paid === true) ------------------------------------
  it("returns isPaymentCompleted when booking.paid is true", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: true,
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPaymentCompleted).toBe(true);
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  // -- Paid booking (successful ON_BOOKING row) -------------------------
  it("returns isPaymentCompleted when ON_BOOKING payment has success=true", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [{ success: true, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPaymentCompleted).toBe(true);
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  // -- Terminal states (cancelled / rejected) ---------------------------
  it("returns no badge for cancelled booking with unpaid payment", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        status: "cancelled",
        paid: false,
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  it("returns no badge for rejected booking with unpaid payment", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        status: "rejected",
        paid: false,
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  // -- Refunded payments -----------------------------------------------
  it("does not show Pending payment when payment is refunded", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [{ success: false, paymentOption: "ON_BOOKING", refunded: true }],
      })
    );
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  it("does not count refunded successful payment as completed", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [{ success: true, paymentOption: "ON_BOOKING", refunded: true }],
      })
    );
    // paid is false and the only success row is refunded, so not completed
    expect(result.isPaymentCompleted).toBe(false);
  });

  // -- Non-ON_BOOKING payment option -----------------------------------
  it("does not show Pending payment for non-ON_BOOKING payment options", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [{ success: false, paymentOption: "HOLD" }],
      })
    );
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });

  // -- Mixed payment rows ----------------------------------------------
  it("handles mixed payment rows — one failed ON_BOOKING, one successful non-ON_BOOKING", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [
          { success: false, paymentOption: "ON_BOOKING" },
          { success: true, paymentOption: "HOLD" },
        ],
      })
    );
    expect(result.isPendingPayment).toBe(true);
    expect(result.paymentBadgeText).toBe("Pending payment");
  });

  it("marks completed when at least one ON_BOOKING row is successful and not refunded", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        paid: false,
        payment: [
          { success: false, paymentOption: "ON_BOOKING" },
          { success: true, paymentOption: "ON_BOOKING" },
        ],
      })
    );
    expect(result.isPaymentCompleted).toBe(true);
    expect(result.isPendingPayment).toBe(false);
  });

  // -- Case-insensitive status check -----------------------------------
  it("handles uppercase status values (CANCELLED)", () => {
    const result = getBookingPaymentStatus(
      makeBooking({
        status: "cancelled",
        paid: false,
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      })
    );
    expect(result.isPendingPayment).toBe(false);
  });

  // -- Free event (no payment rows) ------------------------------------
  it("returns no badge for free event (no payment rows)", () => {
    const booking = makeBooking({
      eventType: { id: 1, title: "Free Event", slug: "free", price: 0 },
    });
    const result = getBookingPaymentStatus(booking);
    expect(result.isPendingPayment).toBe(false);
    expect(result.paymentBadgeText).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recurringGroupHasPendingPayment
// ---------------------------------------------------------------------------
describe("recurringGroupHasPendingPayment", () => {
  it("returns false for empty booking list", () => {
    expect(recurringGroupHasPendingPayment([])).toBe(false);
  });

  it("returns false when no booking has pending payment", () => {
    const bookings = [
      makeBooking({ paid: true, payment: [{ success: true, paymentOption: "ON_BOOKING" }] }),
      makeBooking({ paid: true, payment: [{ success: true, paymentOption: "ON_BOOKING" }] }),
    ];
    expect(recurringGroupHasPendingPayment(bookings)).toBe(false);
  });

  it("returns true when at least one booking has pending payment", () => {
    const bookings = [
      makeBooking({ paid: true, payment: [{ success: true, paymentOption: "ON_BOOKING" }] }),
      makeBooking({ paid: false, payment: [{ success: false, paymentOption: "ON_BOOKING" }] }),
    ];
    expect(recurringGroupHasPendingPayment(bookings)).toBe(true);
  });

  it("returns false when unpaid booking is cancelled", () => {
    const bookings = [
      makeBooking({ paid: true, payment: [{ success: true, paymentOption: "ON_BOOKING" }] }),
      makeBooking({
        status: "cancelled",
        paid: false,
        payment: [{ success: false, paymentOption: "ON_BOOKING" }],
      }),
    ];
    expect(recurringGroupHasPendingPayment(bookings)).toBe(false);
  });
});
