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
  CreatePublicBookingInput,
  CreateEventTypeInput,
  CreateScheduleInput,
  SlotsResponse,
  UpdateEventTypeInput,
  UpdateMeInput,
  UpdateScheduleInput,
} from "./types";

const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";
const API_VERSION = "2024-08-13";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const RETRY_MULTIPLIER = 3;
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);

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

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < maxRetries) {
        await sleep(RETRY_BASE_MS * RETRY_MULTIPLIER ** attempt);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(RETRY_BASE_MS * RETRY_MULTIPLIER ** attempt);
      }
    }
  }

  throw new CalcomApiError(
    `Cal.com API request failed after ${maxRetries + 1} attempts: ${lastError?.message ?? "unknown error"}`,
    undefined,
    "FETCH_RETRY_EXHAUSTED"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function calcomFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
  apiVersion: string = API_VERSION,
  retries: number = MAX_RETRIES
): Promise<T> {
  const url = `${CALCOM_API_URL}${path}`;
  const res = await fetchWithRetry(url, {
    ...options,
    headers: {
      "cal-api-version": apiVersion,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  }, retries);

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
  bookingUidToReschedule?: string;
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
    ...(params.bookingUidToReschedule ? { bookingUidToReschedule: params.bookingUidToReschedule } : {}),
  });
  const data = await calcomFetch<SlotsResponse>(`/v2/slots?${query}`, accessToken, {}, "2024-09-04");
  return data.slots;
}

export interface GetPublicSlotsParams {
  eventTypeSlug: string;
  username: string;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
  bookingUidToReschedule?: string;
}

interface PublicSlotEntry {
  start: string;
}

export async function getAvailableSlotsPublic(
  params: GetPublicSlotsParams
): Promise<Record<string, CalcomSlot[]>> {
  const query = new URLSearchParams({
    eventTypeSlug: params.eventTypeSlug,
    username: params.username,
    start: params.start,
    end: params.end,
    ...(params.timeZone ? { timeZone: params.timeZone } : {}),
    ...(params.duration ? { duration: String(params.duration) } : {}),
    ...(params.bookingUidToReschedule ? { bookingUidToReschedule: params.bookingUidToReschedule } : {}),
  });
  const url = `${CALCOM_API_URL}/v2/slots?${query}`;
  const res = await fetchWithRetry(url, {
    headers: {
      "cal-api-version": "2024-09-04",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new CalcomApiError(`Failed to fetch public slots: ${res.status}`, res.status);
  }
  const json = (await res.json()) as { status: string; data: Record<string, PublicSlotEntry[]> };
  if (json.status === "error") {
    throw new CalcomApiError("Failed to fetch slots for this user", res.status);
  }
  const normalized: Record<string, CalcomSlot[]> = {};
  for (const [date, slots] of Object.entries(json.data)) {
    normalized[date] = slots.map((s) => ({
      time: s.start,
      available: true,
    }));
  }
  return normalized;
}

export interface GetBookingsParams {
  status?: "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed";
  attendeeEmail?: string;
  attendeeName?: string;
  afterStart?: string;
  beforeEnd?: string;
  sortStart?: "asc" | "desc";
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
  if (params.attendeeEmail) query.set("attendeeEmail", params.attendeeEmail);
  if (params.attendeeName) query.set("attendeeName", params.attendeeName);
  if (params.afterStart) query.set("afterStart", params.afterStart);
  if (params.beforeEnd) query.set("beforeEnd", params.beforeEnd);
  if (params.sortStart) query.set("sortStart", params.sortStart);
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
  }, API_VERSION, 0);
}

export async function createBookingPublic(
  input: CreatePublicBookingInput
): Promise<CalcomBooking> {
  const url = `${CALCOM_API_URL}/v2/bookings`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }, 0);
  if (!res.ok) {
    const body = await res.text();
    let message = `Booking failed (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message ?? parsed.message ?? message;
    } catch { /* use default */ }
    throw new CalcomApiError(message, res.status);
  }
  const json = (await res.json()) as CalcomApiResponse<CalcomBooking>;
  if (json.status === "error") {
    throw new CalcomApiError(json.error?.message ?? "Booking failed", undefined, json.error?.code);
  }
  return json.data;
}

export async function cancelBooking(
  accessToken: string,
  bookingUid: string,
  reason?: string,
  cancelSubsequentBookings?: boolean
): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/cancel`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      cancellationReason: reason,
      ...(cancelSubsequentBookings ? { cancelSubsequentBookings: true } : {}),
    }),
  });
}

export async function rescheduleBooking(
  accessToken: string,
  bookingUid: string,
  newStart: string,
  reason?: string,
  rescheduledBy?: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/reschedule`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      start: newStart,
      reschedulingReason: reason,
      ...(rescheduledBy ? { rescheduledBy } : {}),
    }),
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
  }, API_VERSION, 0);
}

// ─── Public event types (no auth) ─────────────────────────────────────────────

export async function getEventTypesByUsername(username: string): Promise<CalcomEventType[]> {
  const url = `${CALCOM_API_URL}/v2/event-types?username=${encodeURIComponent(username)}`;
  const res = await fetchWithRetry(url, {
    headers: {
      "cal-api-version": "2024-06-14",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new CalcomApiError(`Failed to fetch event types for ${username}`, res.status);
  }
  const json = (await res.json()) as CalcomApiResponse<CalcomEventType[]>;
  if (json.status === "error") {
    throw new CalcomApiError(json.error?.message ?? "User not found", undefined, json.error?.code);
  }
  return (json.data ?? []).map((et) => ({
    ...et,
    length: et.length ?? et.lengthInMinutes ?? 0,
  }));
}

// ─── Booking extras ───────────────────────────────────────────────────────────

export async function getCalendarLinks(
  accessToken: string,
  bookingUid: string
): Promise<CalendarLink> {
  return calcomFetch<CalendarLink>(`/v2/bookings/${bookingUid}/calendar-links`, accessToken);
}

export async function markNoShow(
  accessToken: string,
  bookingUid: string,
  host?: boolean,
  attendees?: Array<{ email: string; absent: boolean }>
): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/mark-absent`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      ...(host !== undefined ? { host } : {}),
      ...(attendees ? { attendees } : {}),
    }),
  });
}
