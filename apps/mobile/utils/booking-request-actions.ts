import type { Booking } from "@/services/types/bookings.types";
import { getBookingPaymentStatus } from "@/utils/booking-payment-status";
import { isUserHost, isUserOrganizer } from "@/utils/booking-user-roles";

type CanRespondToBookingRequestParams = {
  booking: Booking;
  currentUserId?: number;
  currentUserEmail?: string;
  now?: Date;
};

type BookingRequestActionState = {
  canConfirm: boolean;
  canReject: boolean;
  showPendingHostConfirmation: boolean;
};

type BookingRequestBulkActionState = {
  canConfirmAll: boolean;
  canRejectAll: boolean;
  showPendingHostConfirmation: boolean;
};

type BookingRequestBulkActionStateParams = {
  bookings: Booking[];
  currentUserId?: number;
  currentUserEmail?: string;
  now?: Date;
};

export const BOOKING_REQUEST_BADGE_LABEL = "Unconfirmed";

const getBookingStatus = (booking: Booking): string => booking.status?.toLowerCase() || "";

const getBookingEndTime = (booking: Booking): string => booking.endTime || booking.end || "";

export const isBookingRequestPending = (booking: Booking): boolean => {
  const status = getBookingStatus(booking);
  return status === "pending" || status === "requires_confirmation";
};

const isBookingInPast = (booking: Booking, now: Date): boolean => {
  const endTime = new Date(getBookingEndTime(booking));
  return !Number.isNaN(endTime.getTime()) && endTime < now;
};

export function getBookingRequestActionState({
  booking,
  currentUserId,
  currentUserEmail,
  now = new Date(),
}: CanRespondToBookingRequestParams): BookingRequestActionState {
  const isPending = isBookingRequestPending(booking);
  const isPast = isBookingInPast(booking, now);
  const { isPendingPayment } = getBookingPaymentStatus(booking);
  const isOrganizer = isUserOrganizer(booking, currentUserId, currentUserEmail);
  const isHost = isUserHost(booking, currentUserId, currentUserEmail);
  const canRespond = isOrganizer || isHost;
  const canReject = isPending && !isPast && canRespond;

  return {
    canConfirm: canReject && !isPendingPayment,
    canReject,
    showPendingHostConfirmation: isPending && !canRespond,
  };
}

export function canRespondToBookingRequest(params: CanRespondToBookingRequestParams): boolean {
  return getBookingRequestActionState(params).canReject;
}

export function getBookingRequestBulkActionState({
  bookings,
  currentUserId,
  currentUserEmail,
  now = new Date(),
}: BookingRequestBulkActionStateParams): BookingRequestBulkActionState {
  const pendingRequestStates = bookings
    .filter((booking) => isBookingRequestPending(booking))
    .map((booking) =>
      getBookingRequestActionState({
        booking,
        currentUserId,
        currentUserEmail,
        now,
      })
    );

  return {
    canConfirmAll:
      pendingRequestStates.length > 0 && pendingRequestStates.every((state) => state.canConfirm),
    canRejectAll:
      pendingRequestStates.length > 0 && pendingRequestStates.every((state) => state.canReject),
    showPendingHostConfirmation: pendingRequestStates.some(
      (state) => state.showPendingHostConfirmation
    ),
  };
}
