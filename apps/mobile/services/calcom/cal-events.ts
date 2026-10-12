/**
 * Cal Events functions for Cal.com API (`/v2/events`)
 */

import { deriveCalEventStatus, getCalEventPublicUrl } from "@/utils/cal-events";

import type {
  CalEvent,
  CalEventApi,
  CalEventBookingApi,
  CalEventCheckInOutcomeApi,
  CalEventCheckInResult,
  CalEventGuest,
  CalEventGuestsPage,
  CalEventsCursorPaginationApi,
  CalEventUndoCheckInOutcomeApi,
} from "../types";

import { ApiRequestError, makeRequest } from "./request";

const API_VERSION = "2024-06-14";

/** The API's largest page. Only the first page is fetched for now; paging through the rest comes later. */
const GUESTS_PAGE_SIZE = 250;

type ListResponse = { status: string; data: CalEventApi[] };
type SingleResponse = { status: string; data: CalEventApi };
type BookingsResponse = {
  status: string;
  data: CalEventBookingApi[];
  pagination: CalEventsCursorPaginationApi;
};

/** The app's view of an event: the API row plus what every screen derives from it. */
export function toCalEvent(event: CalEventApi, now: Date = new Date()): CalEvent {
  const address = event.locations.find(
    (location): location is Extract<CalEventApi["locations"][number], { type: "address" }> =>
      location.type === "address"
  );
  return {
    ...event,
    status: deriveCalEventStatus(event, now),
    locationAddress: address?.address ?? null,
    publicUrl: getCalEventPublicUrl(event.slug),
  };
}

/**
 * Get the events the authenticated user hosts (own + co-hosted), or every event a team owns
 * when `teamId` is given. 403 on a team the user isn't an accepted member of.
 */
export async function getCalEvents(teamId?: number | null): Promise<CalEvent[]> {
  const endpoint = teamId ? `/teams/${teamId}/events` : "/events";
  const response = await makeRequest<ListResponse>(endpoint, {}, API_VERSION);
  const now = new Date();
  return Array.isArray(response?.data) ? response.data.map((event) => toCalEvent(event, now)) : [];
}

/**
 * Get a single event. Resolves to null on 404 (missing, or not manageable by this user).
 */
export async function getCalEvent(uuid: string): Promise<CalEvent | null> {
  try {
    const response = await makeRequest<SingleResponse>(`/events/${uuid}`, {}, API_VERSION);
    return response?.data ? toCalEvent(response.data) : null;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Take a draft live. Hosts only.
 */
export async function publishCalEvent(uuid: string): Promise<CalEvent> {
  const response = await makeRequest<SingleResponse>(
    `/events/${uuid}/publish`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from publish event API");
  return toCalEvent(response.data);
}

/**
 * Cancel a published event and notify its guests. Hosts only.
 */
export async function cancelCalEvent(uuid: string, reason?: string): Promise<CalEvent> {
  const response = await makeRequest<SingleResponse>(
    `/events/${uuid}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from cancel event API");
  return toCalEvent(response.data);
}

/**
 * Permanently delete an event. Hosts only; a published event with guests must be cancelled first.
 */
export async function deleteCalEvent(uuid: string): Promise<void> {
  await makeRequest<{ status: string }>(`/events/${uuid}`, { method: "DELETE" }, API_VERSION);
}

/** The app's view of a guest: the one place the guest list's API shape is read. */
export function toCalEventGuest(booking: CalEventBookingApi): CalEventGuest {
  return {
    id: booking.registrationId,
    name: booking.name,
    email: booking.email,
    phoneNumber: booking.phoneNumber ?? null,
    checkedInAt: booking.checkedInAt ?? null,
  };
}

/**
 * Get the first page of an event's confirmed guests. Hosts, accepted co-hosts and team members
 * with access only; anyone else gets the same 404 as for an unknown event.
 */
export async function getCalEventGuests(uuid: string): Promise<CalEventGuestsPage> {
  const response = await makeRequest<BookingsResponse>(
    `/events/${uuid}/bookings?limit=${GUESTS_PAGE_SIZE}`,
    {},
    API_VERSION
  );
  return {
    guests: Array.isArray(response?.data) ? response.data.map(toCalEventGuest) : [],
    hasMore: response?.pagination?.hasMore ?? false,
  };
}

/**
 * Check a guest in at the door. 400 on a cancelled event, or outside its check-in window.
 */
export async function checkInCalEventGuest(
  uuid: string,
  guestId: string
): Promise<CalEventCheckInResult> {
  const response = await makeRequest<{ status: string; data: CalEventCheckInOutcomeApi }>(
    `/events/${uuid}/registrations/${guestId}/check-in`,
    { method: "POST" },
    API_VERSION
  );
  const outcome = response?.data;
  if (!outcome?.kind) throw new Error("Invalid response from check-in API");
  return outcome.kind === "already_checked_in"
    ? { kind: outcome.kind, checkedInAt: outcome.checkedInAt }
    : { kind: outcome.kind };
}

/**
 * Undo a guest's check-in. Idempotent, and allowed after the check-in window closes.
 */
export async function undoCalEventGuestCheckIn(uuid: string, guestId: string): Promise<void> {
  await makeRequest<{ status: string; data: CalEventUndoCheckInOutcomeApi }>(
    `/events/${uuid}/registrations/${guestId}/check-in`,
    { method: "DELETE" },
    API_VERSION
  );
}
