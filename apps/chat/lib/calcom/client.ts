import type {
  AddAttendeeInput,
  BusyTime,
  CalcomApiResponse,
  CalcomBooking,
  CalcomEventType,
  CalcomSchedule,
  CalcomSlot,
  CalendarLink,
  CreateBookingInput,
  CreateEventTypeInput,
  CreateScheduleInput,
  SlotsResponse,
  UpdateEventTypeInput,
  UpdateMeInput,
  UpdateScheduleInput,
} from "./types";

const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";
const API_VERSION = "2024-08-13";

export class CalcomApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "CalcomApiError";
  }
}

async function calcomFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
  apiVersion: string = API_VERSION
): Promise<T> {
  const url = `${CALCOM_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "cal-api-version": apiVersion,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Cal.com API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as CalcomApiResponse<unknown>;
      if (body.error?.message) errorMessage = body.error.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new CalcomApiError(errorMessage, res.status);
  }

  const json = (await res.json()) as CalcomApiResponse<T>;
  if (json.status === "error") {
    throw new CalcomApiError(
      json.error?.message ?? "Unknown Cal.com API error",
      undefined,
      json.error?.code
    );
  }
  return json.data;
}

export async function getEventTypes(accessToken: string): Promise<CalcomEventType[]> {
  const raw = await calcomFetch<CalcomEventType[]>(
    "/v2/event-types",
    accessToken,
    {},
    "2024-06-14"
  );
  return (raw ?? []).map((et) => ({
    ...et,
    length: et.length ?? et.lengthInMinutes ?? 0,
  }));
}

export async function getEventType(
  accessToken: string,
  eventTypeId: number
): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(
    `/v2/event-types/${eventTypeId}`,
    accessToken,
    {},
    "2024-06-14"
  );
}

export interface GetSlotsParams {
  eventTypeId: number;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
}

export async function getAvailableSlots(
  accessToken: string,
  params: GetSlotsParams
): Promise<Record<string, CalcomSlot[]>> {
  const query = new URLSearchParams({
    eventTypeId: String(params.eventTypeId),
    start: params.start,
    end: params.end,
    ...(params.timeZone ? { timeZone: params.timeZone } : {}),
    ...(params.duration ? { duration: String(params.duration) } : {}),
  });
  const data = await calcomFetch<SlotsResponse>(`/v2/slots?${query}`, accessToken);
  return data.slots;
}

export interface GetBookingsParams {
  status?: "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed";
  take?: number;
  skip?: number;
}

export interface BookingCurrentUser {
  id: number;
  email: string;
}

export async function getBookings(
  accessToken: string,
  params: GetBookingsParams = {},
  currentUser?: BookingCurrentUser
): Promise<CalcomBooking[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.take) query.set("take", String(params.take));
  if (params.skip) query.set("skip", String(params.skip));
  const qs = query.toString() ? `?${query}` : "";
  const bookings = await calcomFetch<CalcomBooking[]>(`/v2/bookings${qs}`, accessToken);

  // Team admins see all team bookings from the API. Filter to only bookings
  // where the current user is a host or attendee to prevent leaking other
  // members' appointments. Matches the mobile companion app's approach.
  if (!currentUser) return bookings;

  const emailLower = currentUser.email.toLowerCase();
  return bookings.filter((booking) => {
    const isHost = booking.hosts?.some(
      (h) => h.id === currentUser.id || h.email?.toLowerCase() === emailLower
    );
    const isAttendee = booking.attendees?.some((a) => a.email?.toLowerCase() === emailLower);
    const isOrganizer =
      booking.organizer?.id === currentUser.id ||
      booking.organizer?.email?.toLowerCase() === emailLower;
    return isHost || isAttendee || isOrganizer;
  });
}

export async function getBooking(accessToken: string, bookingUid: string): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}`, accessToken);
}

export async function createBooking(
  accessToken: string,
  input: CreateBookingInput
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>("/v2/bookings", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelBooking(
  accessToken: string,
  bookingUid: string,
  reason?: string
): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/cancel`, accessToken, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: reason }),
  });
}

export async function rescheduleBooking(
  accessToken: string,
  bookingUid: string,
  newStart: string,
  reason?: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/reschedule`, accessToken, {
    method: "POST",
    body: JSON.stringify({ start: newStart, reschedulingReason: reason }),
  });
}

export interface CalcomMe {
  id: number;
  username: string;
  email: string;
  name: string;
  timeZone: string;
}

export async function getMe(accessToken: string): Promise<CalcomMe> {
  return calcomFetch<CalcomMe>("/v2/me", accessToken);
}

export async function updateMe(accessToken: string, input: UpdateMeInput): Promise<CalcomMe> {
  return calcomFetch<CalcomMe>("/v2/me", accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ─── Schedules ───────────────────────────────────────────────────────────────

const SCHEDULES_VERSION = "2024-06-11";

export async function getSchedules(accessToken: string): Promise<CalcomSchedule[]> {
  return calcomFetch<CalcomSchedule[]>("/v2/schedules", accessToken, {}, SCHEDULES_VERSION);
}

export async function getDefaultSchedule(accessToken: string): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>("/v2/schedules/default", accessToken, {}, SCHEDULES_VERSION);
}

export async function getSchedule(
  accessToken: string,
  scheduleId: number
): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(
    `/v2/schedules/${scheduleId}`,
    accessToken,
    {},
    SCHEDULES_VERSION
  );
}

export async function createSchedule(
  accessToken: string,
  input: CreateScheduleInput
): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(
    "/v2/schedules",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    SCHEDULES_VERSION
  );
}

export async function updateSchedule(
  accessToken: string,
  scheduleId: number,
  input: UpdateScheduleInput
): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(
    `/v2/schedules/${scheduleId}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    SCHEDULES_VERSION
  );
}

export async function deleteSchedule(accessToken: string, scheduleId: number): Promise<void> {
  await calcomFetch<void>(
    `/v2/schedules/${scheduleId}`,
    accessToken,
    {
      method: "DELETE",
    },
    SCHEDULES_VERSION
  );
}

// ─── Booking confirm / decline ────────────────────────────────────────────────

export async function confirmBooking(
  accessToken: string,
  bookingUid: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/confirm`, accessToken, {
    method: "POST",
  });
}

export async function declineBooking(
  accessToken: string,
  bookingUid: string,
  reason?: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/decline`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ─── Calendar busy times ──────────────────────────────────────────────────────

export interface GetBusyTimesParams {
  start: string;
  end: string;
}

export async function getBusyTimes(
  accessToken: string,
  params: GetBusyTimesParams
): Promise<BusyTime[]> {
  const query = new URLSearchParams({ start: params.start, end: params.end });
  return calcomFetch<BusyTime[]>(`/v2/calendars/busy-times?${query}`, accessToken);
}

// ─── Event type CRUD ──────────────────────────────────────────────────────────

export async function createEventType(
  accessToken: string,
  input: CreateEventTypeInput
): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(
    "/v2/event-types",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    "2024-06-14"
  );
}

export async function updateEventType(
  accessToken: string,
  eventTypeId: number,
  input: UpdateEventTypeInput
): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(
    `/v2/event-types/${eventTypeId}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    "2024-06-14"
  );
}

export async function deleteEventType(accessToken: string, eventTypeId: number): Promise<void> {
  await calcomFetch<void>(
    `/v2/event-types/${eventTypeId}`,
    accessToken,
    {
      method: "DELETE",
    },
    "2024-06-14"
  );
}

// ─── Booking attendees ───────────────────────────────────────────────────────

export async function addBookingAttendee(
  accessToken: string,
  bookingUid: string,
  input: AddAttendeeInput
): Promise<void> {
  await calcomFetch<unknown>(`/v2/bookings/${bookingUid}/attendees`, accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Booking extras ───────────────────────────────────────────────────────────

export async function getCalendarLinks(
  accessToken: string,
  bookingUid: string
): Promise<CalendarLink> {
  return calcomFetch<CalendarLink>(`/v2/bookings/${bookingUid}/calendar-links`, accessToken);
}

export async function markNoShow(accessToken: string, bookingUid: string): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/mark-absent`, accessToken, {
    method: "POST",
  });
}
