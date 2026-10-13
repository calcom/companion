/**
 * Cal Events functions for Cal.com API (`/v2/events`)
 */

import { deriveCalEventStatus, getCalEventPublicUrl } from "@/utils/cal-events";

import type { CalEvent, CalEventApi, CalEventsPage } from "../types";

import { ApiRequestError, makeRequest } from "./request";

const API_VERSION = "2024-06-14";
/** The listings switch from take/skip to `limit` + `cursor` from this version on. */
const LIST_API_VERSION = "2026-05-01";
/** Events per page; the API defaults to 50. */
export const CAL_EVENTS_PAGE_SIZE = 25;

type ListResponse = {
  status: string;
  data: CalEventApi[];
  pagination?: { nextCursor: string | null; hasMore: boolean };
};
type SingleResponse = { status: string; data: CalEventApi };

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
 * Get one page of the events the authenticated user hosts (own + co-hosted), or of every event
 * a team owns when `teamId` is given, newest start time first. Omit `cursor` for the first page.
 * 403 on a team the user isn't an accepted member of.
 */
export async function getCalEvents(
  teamId?: number | null,
  cursor?: string | null
): Promise<CalEventsPage> {
  const params = new URLSearchParams({ limit: String(CAL_EVENTS_PAGE_SIZE) });
  if (cursor) params.append("cursor", cursor);
  const endpoint = `${teamId ? `/teams/${teamId}/events` : "/events"}?${params.toString()}`;
  const response = await makeRequest<ListResponse>(endpoint, {}, LIST_API_VERSION);
  const now = new Date();
  const events = Array.isArray(response?.data)
    ? response.data.map((event) => toCalEvent(event, now))
    : [];
  const nextCursor = response?.pagination?.nextCursor ?? null;
  // Without a cursor there is no way to ask for the next page, whatever `hasMore` says.
  return { events, nextCursor, hasMore: !!response?.pagination?.hasMore && nextCursor !== null };
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
