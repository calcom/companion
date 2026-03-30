import type { Booking } from "@/services/types/bookings.types";

/**
 * Derived payment status for a booking, used to render payment-related badges.
 */
export interface BookingPaymentStatus {
  /** Whether the booking's payment has been completed. */
  isPaymentCompleted: boolean;
  /** Whether the booking is awaiting an ON_BOOKING payment. */
  isPendingPayment: boolean;
  /** Badge text to display, or null if no payment badge is needed. */
  paymentBadgeText: string | null;
}

function getOnBookingPaymentOption(booking: Booking): string | null {
  const metadata = booking.eventType?.metadata;
  if (!metadata || typeof metadata !== "object") return null;

  const apps = (metadata as { apps?: Record<string, unknown> }).apps;
  if (!apps || typeof apps !== "object") return null;

  for (const appConfig of Object.values(apps)) {
    if (!appConfig || typeof appConfig !== "object") continue;

    const paymentOption = (appConfig as { paymentOption?: unknown }).paymentOption;
    if (typeof paymentOption === "string") {
      return paymentOption;
    }
  }

  return null;
}

/**
 * Derives the payment UI state from a raw booking payload.
 *
 * Rules:
 * - `isPaymentCompleted`: true when `paid === true` OR an ON_BOOKING payment
 *   row exists with `success === true` and `refunded !== true`.
 * - `isPendingPayment`: true when all of:
 *   1. `isPaymentCompleted` is false
 *   2. At least one payment row has `paymentOption === "ON_BOOKING"`
 *   3. At least one payment row has `success === false`
 *   4. The booking is not cancelled or rejected (no actionable payment badge
 *      for terminal states)
 *   5. No payment row is refunded (refunds are not "pending")
 * - Cancelled/rejected bookings never show a payment badge.
 * - If `payment[]` is absent, fall back to event type payment config only when
 *   the booking is still pending, the event type is paid, and the payment
 *   option is explicitly `ON_BOOKING`.
 */
export function getBookingPaymentStatus(booking: Booking): BookingPaymentStatus {
  const NO_PAYMENT: BookingPaymentStatus = {
    isPaymentCompleted: false,
    isPendingPayment: false,
    paymentBadgeText: null,
  };

  // Terminal booking states never show a payment badge
  const status = booking.status?.toLowerCase();
  if (status === "cancelled" || status === "rejected") {
    return NO_PAYMENT;
  }

  const payments = booking.payment;

  // No payment rows -> fall back to explicit event type payment config if available
  if (!payments || payments.length === 0) {
    const status = booking.status?.toLowerCase();
    const paymentOption = getOnBookingPaymentOption(booking);
    const isPaidEvent = (booking.eventType?.price ?? 0) > 0;

    if (status === "pending" && booking.paid !== true && isPaidEvent && paymentOption === "ON_BOOKING") {
      return {
        isPaymentCompleted: false,
        isPendingPayment: true,
        paymentBadgeText: "Pending payment",
      };
    }

    return NO_PAYMENT;
  }

  // Check for refunded payments - don't regress into "Pending payment"
  const hasRefundedPayment = payments.some((p) => p.refunded === true);

  // Check if payment is completed
  const isPaymentCompleted =
    booking.paid === true ||
    payments.some(
      (p) =>
        p.paymentOption === "ON_BOOKING" && p.success === true && p.refunded !== true
    );

  if (isPaymentCompleted) {
    return {
      isPaymentCompleted: true,
      isPendingPayment: false,
      paymentBadgeText: null,
    };
  }

  // Check if there's a pending ON_BOOKING payment
  const hasOnBookingPayment = payments.some(
    (p) => p.paymentOption === "ON_BOOKING"
  );
  const hasFailedPayment = payments.some((p) => p.success === false);

  const isPendingPayment =
    hasOnBookingPayment && hasFailedPayment && !hasRefundedPayment;

  return {
    isPaymentCompleted: false,
    isPendingPayment,
    paymentBadgeText: isPendingPayment ? "Pending payment" : null,
  };
}

/**
 * Checks whether the bookings represented by a recurring row should show the
 * pending payment badge.
 */
export function shouldShowRecurringPendingPaymentBadge(bookings: Booking[]): boolean {
  return bookings.some((booking) => getBookingPaymentStatus(booking).isPendingPayment);
}
