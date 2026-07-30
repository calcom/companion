import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";
import type { Booking } from "@/services/calcom";

export interface BookingListCacheFilters {
  status?: unknown;
  fromDate?: unknown;
  toDate?: unknown;
  eventTypeId?: unknown;
  [key: string]: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getStatusFilters = (status: unknown): string[] => {
  if (Array.isArray(status)) {
    return status.filter((value): value is string => typeof value === "string");
  }

  return typeof status === "string" ? [status] : [];
};

const getBookingStartTime = (booking: Booking): string => booking.start || booking.startTime || "";

const getBookingEndTime = (booking: Booking): string => booking.end || booking.endTime || "";

const getBookingEventTypeId = (booking: Booking): number | undefined =>
  booking.eventTypeId ?? booking.eventType?.id;

const getBookingStatus = (booking: Booking): string => booking.status?.toLowerCase() || "";

const isPendingBooking = (booking: Booking): boolean => {
  const status = getBookingStatus(booking);
  return status === "pending" || status === "requires_confirmation";
};

const isCancelledOrRejectedBooking = (booking: Booking): boolean => {
  const status = getBookingStatus(booking);
  return status === "cancelled" || status === "rejected";
};

const isRecurringBooking = (booking: Booking): boolean =>
  Boolean(booking.recurringBookingUid || booking.recurringEventId);

const getTime = (dateString: unknown): number | null => {
  if (typeof dateString !== "string" || dateString.length === 0) return null;

  const time = new Date(dateString).getTime();
  return Number.isNaN(time) ? null : time;
};

const matchesDateRange = (booking: Booking, filters: BookingListCacheFilters): boolean => {
  const startTime = getTime(getBookingStartTime(booking));
  if (startTime === null) return false;

  const fromTime = getTime(filters.fromDate);
  if (fromTime !== null && startTime < fromTime) return false;

  const toTime = getTime(filters.toDate);
  if (toTime !== null && startTime > toTime) return false;

  return true;
};

const bookingMatchesStatusFilter = (booking: Booking, statusFilter: string, now: Date): boolean => {
  const normalizedStatusFilter = statusFilter.toLowerCase();
  const status = getBookingStatus(booking);
  const endTime = getTime(getBookingEndTime(booking));
  const isPast = endTime !== null && endTime < now.getTime();

  switch (normalizedStatusFilter) {
    case "upcoming":
      return !isPast && !isPendingBooking(booking) && !isCancelledOrRejectedBooking(booking);
    case "unconfirmed":
      return isPendingBooking(booking);
    case "past":
      return isPast && !isCancelledOrRejectedBooking(booking);
    case "cancelled":
      return isCancelledOrRejectedBooking(booking);
    case "recurring":
      return isRecurringBooking(booking);
    default:
      return status === normalizedStatusFilter;
  }
};

export const bookingMatchesListFilters = (
  booking: Booking,
  filters: BookingListCacheFilters,
  now = new Date()
): boolean => {
  const eventTypeId = filters.eventTypeId;
  if (typeof eventTypeId === "number" && getBookingEventTypeId(booking) !== eventTypeId) {
    return false;
  }

  if (!matchesDateRange(booking, filters)) {
    return false;
  }

  const statusFilters = getStatusFilters(filters.status);
  if (statusFilters.length === 0) {
    return true;
  }

  return statusFilters.some((status) => bookingMatchesStatusFilter(booking, status, now));
};

const mergeBookingForCache = (
  currentBooking: Booking | undefined,
  updatedBooking: Booking
): Booking => {
  if (!currentBooking) return updatedBooking;

  const mergedEventType =
    currentBooking.eventType && updatedBooking.eventType
      ? {
          ...currentBooking.eventType,
          ...updatedBooking.eventType,
        }
      : (updatedBooking.eventType ?? currentBooking.eventType);

  return {
    ...currentBooking,
    ...updatedBooking,
    eventType: mergedEventType,
  };
};

export const updateBookingListForFilters = (
  currentBookings: Booking[] | undefined,
  updatedBooking: Booking,
  filters: BookingListCacheFilters,
  now = new Date()
): Booking[] | undefined => {
  if (!currentBookings) return currentBookings;

  const currentBooking = currentBookings.find((booking) => booking.uid === updatedBooking.uid);
  const bookingForCache = mergeBookingForCache(currentBooking, updatedBooking);
  const bookingsWithoutUpdated = currentBookings.filter(
    (booking) => booking.uid !== updatedBooking.uid
  );

  if (!bookingMatchesListFilters(bookingForCache, filters, now)) {
    return bookingsWithoutUpdated;
  }

  return [...bookingsWithoutUpdated, bookingForCache];
};

const getBookingListFiltersFromQueryKey = (queryKey: QueryKey): BookingListCacheFilters | null => {
  const [resource, scope, filters] = queryKey;
  if (resource !== "bookings" || scope !== "list") {
    return null;
  }

  return isObject(filters) ? filters : {};
};

export const updateBookingCaches = (queryClient: QueryClient, updatedBooking: Booking): void => {
  queryClient.setQueryData(queryKeys.bookings.detail(updatedBooking.uid), updatedBooking);

  const listQueries = queryClient.getQueryCache().findAll({ queryKey: queryKeys.bookings.lists() });

  for (const query of listQueries) {
    const filters = getBookingListFiltersFromQueryKey(query.queryKey);
    if (!filters) continue;

    queryClient.setQueryData<Booking[]>(query.queryKey, (currentBookings) =>
      updateBookingListForFilters(currentBookings, updatedBooking, filters)
    );
  }
};

export const syncBookingCachesAfterMutation = (
  queryClient: QueryClient,
  updatedBooking: Booking
): void => {
  updateBookingCaches(queryClient, updatedBooking);
  void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
};

export const getBookingForCacheUpdate = (
  queryClient: QueryClient,
  bookingUid: string,
  fallbackBooking: Booking | null | undefined
): Booking | null | undefined =>
  queryClient.getQueryData<Booking>(queryKeys.bookings.detail(bookingUid)) ?? fallbackBooking;
