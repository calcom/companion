import type {
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
  apiKey: string,
  options: RequestInit = {},
  apiVersion: string = API_VERSION
): Promise<T> {
  const url = `${CALCOM_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "cal-api-version": apiVersion,
      Authorization: `Bearer ${apiKey}`,
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

export async function getEventTypes(apiKey: string): Promise<CalcomEventType[]> {
  const raw = await calcomFetch<CalcomEventType[]>("/v2/event-types", apiKey, {}, "2024-06-14");
  return (raw ?? []).map((et) => ({
    ...et,
    length: et.length ?? et.lengthInMinutes ?? 0,
  }));
}

export async function getEventType(apiKey: string, eventTypeId: number): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(`/v2/event-types/${eventTypeId}`, apiKey, {}, "2024-06-14");
}

export interface GetSlotsParams {
  eventTypeId: number;
  start: string; // ISO 8601
  end: string; // ISO 8601
  timeZone?: string;
  duration?: number;
}

export async function getAvailableSlots(
  apiKey: string,
  params: GetSlotsParams
): Promise<Record<string, CalcomSlot[]>> {
  const query = new URLSearchParams({
    eventTypeId: String(params.eventTypeId),
    start: params.start,
    end: params.end,
    ...(params.timeZone ? { timeZone: params.timeZone } : {}),
    ...(params.duration ? { duration: String(params.duration) } : {}),
  });
  const data = await calcomFetch<SlotsResponse>(`/v2/slots?${query}`, apiKey);
  return data.slots;
}

export interface GetBookingsParams {
  status?: "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed";
  take?: number;
  skip?: number;
}

export async function getBookings(
  apiKey: string,
  params: GetBookingsParams = {}
): Promise<CalcomBooking[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.take) query.set("take", String(params.take));
  if (params.skip) query.set("skip", String(params.skip));
  const qs = query.toString() ? `?${query}` : "";
  return calcomFetch<CalcomBooking[]>(`/v2/bookings${qs}`, apiKey);
}

export async function getBooking(apiKey: string, bookingUid: string): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}`, apiKey);
}

export async function createBooking(
  apiKey: string,
  input: CreateBookingInput
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>("/v2/bookings", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelBooking(
  apiKey: string,
  bookingUid: string,
  reason?: string
): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/cancel`, apiKey, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: reason }),
  });
}

export async function rescheduleBooking(
  apiKey: string,
  bookingUid: string,
  newStart: string,
  reason?: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/reschedule`, apiKey, {
    method: "POST",
    body: JSON.stringify({ start: newStart, reschedulingReason: reason }),
  });
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await calcomFetch<unknown>("/v2/me", apiKey);
    return true;
  } catch {
    return false;
  }
}

export interface CalcomMe {
  id: number;
  username: string;
  email: string;
  name: string;
  timeZone: string;
}

export async function getMe(apiKey: string): Promise<CalcomMe> {
  return calcomFetch<CalcomMe>("/v2/me", apiKey);
}

export async function updateMe(apiKey: string, input: UpdateMeInput): Promise<CalcomMe> {
  return calcomFetch<CalcomMe>("/v2/me", apiKey, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ─── Schedules ───────────────────────────────────────────────────────────────

const SCHEDULES_VERSION = "2024-06-11";

export async function getSchedules(apiKey: string): Promise<CalcomSchedule[]> {
  return calcomFetch<CalcomSchedule[]>("/v2/schedules", apiKey, {}, SCHEDULES_VERSION);
}

export async function getDefaultSchedule(apiKey: string): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>("/v2/schedules/default", apiKey, {}, SCHEDULES_VERSION);
}

export async function getSchedule(apiKey: string, scheduleId: number): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(`/v2/schedules/${scheduleId}`, apiKey, {}, SCHEDULES_VERSION);
}

export async function createSchedule(
  apiKey: string,
  input: CreateScheduleInput
): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(
    "/v2/schedules",
    apiKey,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    SCHEDULES_VERSION
  );
}

export async function updateSchedule(
  apiKey: string,
  scheduleId: number,
  input: UpdateScheduleInput
): Promise<CalcomSchedule> {
  return calcomFetch<CalcomSchedule>(
    `/v2/schedules/${scheduleId}`,
    apiKey,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    SCHEDULES_VERSION
  );
}

export async function deleteSchedule(apiKey: string, scheduleId: number): Promise<void> {
  await calcomFetch<void>(
    `/v2/schedules/${scheduleId}`,
    apiKey,
    {
      method: "DELETE",
    },
    SCHEDULES_VERSION
  );
}

// ─── Booking confirm / decline ────────────────────────────────────────────────

export async function confirmBooking(apiKey: string, bookingUid: string): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/confirm`, apiKey, {
    method: "POST",
  });
}

export async function declineBooking(
  apiKey: string,
  bookingUid: string,
  reason?: string
): Promise<CalcomBooking> {
  return calcomFetch<CalcomBooking>(`/v2/bookings/${bookingUid}/decline`, apiKey, {
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
  apiKey: string,
  params: GetBusyTimesParams
): Promise<BusyTime[]> {
  const query = new URLSearchParams({ start: params.start, end: params.end });
  return calcomFetch<BusyTime[]>(`/v2/calendars/busy-times?${query}`, apiKey);
}

// ─── Event type CRUD ──────────────────────────────────────────────────────────

export async function createEventType(
  apiKey: string,
  input: CreateEventTypeInput
): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(
    "/v2/event-types",
    apiKey,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    "2024-06-14"
  );
}

export async function updateEventType(
  apiKey: string,
  eventTypeId: number,
  input: UpdateEventTypeInput
): Promise<CalcomEventType> {
  return calcomFetch<CalcomEventType>(
    `/v2/event-types/${eventTypeId}`,
    apiKey,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    "2024-06-14"
  );
}

export async function deleteEventType(apiKey: string, eventTypeId: number): Promise<void> {
  await calcomFetch<void>(
    `/v2/event-types/${eventTypeId}`,
    apiKey,
    {
      method: "DELETE",
    },
    "2024-06-14"
  );
}

// ─── Booking extras ───────────────────────────────────────────────────────────

export async function getCalendarLinks(apiKey: string, bookingUid: string): Promise<CalendarLink> {
  return calcomFetch<CalendarLink>(`/v2/bookings/${bookingUid}/calendar-links`, apiKey);
}

export async function markNoShow(apiKey: string, bookingUid: string): Promise<void> {
  await calcomFetch<void>(`/v2/bookings/${bookingUid}/mark-absent`, apiKey, {
    method: "POST",
  });
}
