import type { Booking } from "@/services/types/bookings.types";
import { getBookingPaymentStatus } from "@/utils/booking-payment-status";

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

const getBookingStatus = (booking: Booking): string => booking.status?.toLowerCase() || "";

const getBookingEndTime = (booking: Booking): string => booking.endTime || booking.end || "";

export const isBookingRequestPending = (booking: Booking): boolean => {
  const status = getBookingStatus(booking);
  return (
    status === "pending" ||
    status === "requires_confirmation" ||
    booking.requiresConfirmation === true
  );
};

const isBookingInPast = (booking: Booking, now: Date): boolean => {
  const endTime = new Date(getBookingEndTime(booking));
  return !Number.isNaN(endTime.getTime()) && endTime < now;
};

const isUserOrganizer = (booking: Booking, userId?: number, userEmail?: string): boolean => {
  if (!booking.user) return false;

  if (userId && booking.user.id === userId) return true;
  if (userEmail && booking.user.email?.toLowerCase() === userEmail.toLowerCase()) return true;

  return false;
};

const isUserHost = (booking: Booking, userId?: number, userEmail?: string): boolean => {
  if (!booking.hosts || booking.hosts.length === 0) return false;

  return booking.hosts.some((host) => {
    if (userId && host.id !== undefined && String(host.id) === String(userId)) return true;
    if (userEmail && host.email?.toLowerCase() === userEmail.toLowerCase()) return true;
    return false;
  });
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
