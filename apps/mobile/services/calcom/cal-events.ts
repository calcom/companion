/**
 * Cal Events functions for Cal.com API (`/v2/cal-events`)
 */

import type { CalEvent } from "../types";

import { makeRequest } from "./request";

const API_VERSION = "2024-06-14";

type ListResponse = { status: string; data: CalEvent[] };
type SingleResponse = { status: string; data: CalEvent };

/**
 * Get the authenticated user's cal events (personal + co-hosted), or a team's when
 * `teamId` is given.
 */
export async function getCalEvents(teamId?: number | null): Promise<CalEvent[]> {
  const endpoint = teamId ? `/cal-events?teamId=${teamId}` : "/cal-events";
  const response = await makeRequest<ListResponse>(endpoint, {}, API_VERSION);
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Get a single cal event. Resolves to null on 404 (missing, or not manageable by this user).
 */
export async function getCalEvent(eventTypeUuid: string): Promise<CalEvent | null> {
  try {
    const response = await makeRequest<SingleResponse>(
      `/cal-events/${eventTypeUuid}`,
      {},
      API_VERSION
    );
    return response?.data ?? null;
  } catch (error) {
    if (error instanceof Error && /API Error: 404/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

/**
 * Take a draft live. Hosts only.
 */
export async function publishCalEvent(eventTypeUuid: string): Promise<CalEvent> {
  const response = await makeRequest<SingleResponse>(
    `/cal-events/${eventTypeUuid}/publish`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from publish cal event API");
  return response.data;
}

/**
 * Cancel an event and notify its guests. Hosts only.
 */
export async function cancelCalEvent(eventTypeUuid: string, reason?: string): Promise<CalEvent> {
  const response = await makeRequest<SingleResponse>(
    `/cal-events/${eventTypeUuid}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from cancel cal event API");
  return response.data;
}

/**
 * Permanently delete an event. Hosts only; a published event with guests must be cancelled first.
 */
export async function deleteCalEvent(eventTypeUuid: string): Promise<void> {
  await makeRequest<{ status: string }>(
    `/cal-events/${eventTypeUuid}`,
    { method: "DELETE" },
    API_VERSION
  );
}
