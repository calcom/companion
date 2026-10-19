/**
 * Cal Events functions for Cal.com API (`/v2/events`)
 */

import { deriveCalEventStatus, getCalEventPublicUrl } from "@/utils/cal-events";

import type {
  AddCalEventLocationInput,
  CalEvent,
  CalEventApi,
  CalEventCoHost,
  CalEventLocation,
  CreateCalEventInput,
  UpdateCalEventInput,
} from "../types";

import { ApiRequestError, makeRequest } from "./request";

const API_VERSION = "2024-06-14";

type ListResponse = { status: string; data: CalEventApi[] };
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
 * Create an event as a draft: the user's own, or the team's when `teamId` is given (needs the
 * team's `calEvent.create` permission, else 403).
 */
export async function createCalEvent(
  input: CreateCalEventInput,
  teamId?: number | null
): Promise<CalEvent> {
  const endpoint = teamId ? `/teams/${teamId}/events` : "/events";
  const response = await makeRequest<SingleResponse>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from create event API");
  return toCalEvent(response.data);
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

/**
 * Save an edit. Send only what changed: the rest stays as stored. Hosts only; 400 on a cancelled
 * event, and on a slug change once published (403 for the guest list).
 */
export async function updateCalEvent(uuid: string, input: UpdateCalEventInput): Promise<CalEvent> {
  const response = await makeRequest<SingleResponse>(
    `/events/${uuid}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from update event API");
  return toCalEvent(response.data);
}

/** The event's locations, with their ids. */
export async function getCalEventLocations(uuid: string): Promise<CalEventLocation[]> {
  const response = await makeRequest<{ status: string; data: CalEventLocation[] }>(
    `/events/${uuid}/locations`,
    {},
    API_VERSION
  );
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Add one location after the existing ones; there is no edit or delete. One address per event,
 * and on a published event the guests are emailed about it.
 */
export async function addCalEventLocation(
  uuid: string,
  location: AddCalEventLocationInput
): Promise<CalEventLocation> {
  const response = await makeRequest<{ status: string; data: CalEventLocation }>(
    `/events/${uuid}/locations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from add location API");
  return response.data;
}

/** A picked image, as React Native's FormData takes a file. */
export interface CalEventImageFile {
  uri: string;
  name: string;
  /** image/jpeg, image/png or image/webp. */
  type: string;
}

function imageFormData(file: CalEventImageFile): FormData {
  const body = new FormData();
  // React Native reads { uri, name, type } as a file part.
  body.append("file", file as unknown as Blob);
  return body;
}

/** Replace the cover (and any poster design). JPEG, PNG or WebP, up to 10 MB. */
export async function uploadCalEventCoverImage(
  uuid: string,
  file: CalEventImageFile
): Promise<string> {
  const response = await makeRequest<{ status: string; data: { coverImageUrl: string } }>(
    `/events/${uuid}/cover-image`,
    { method: "POST", body: imageFormData(file) },
    API_VERSION
  );
  if (!response?.data?.coverImageUrl) throw new Error("Invalid response from cover image API");
  return response.data.coverImageUrl;
}

/** Remove the cover. Fine to call when there is none. */
export async function deleteCalEventCoverImage(uuid: string): Promise<void> {
  await makeRequest<{ status: string }>(
    `/events/${uuid}/cover-image`,
    { method: "DELETE" },
    API_VERSION
  );
}

/**
 * Upload a lineup or schedule person's photo. Changes nothing on the event: put the returned URL
 * in the person's avatarUrl and save. JPEG, PNG or WebP, up to 2 MB and 2048 px.
 */
export async function uploadCalEventPersonAvatar(
  uuid: string,
  file: CalEventImageFile
): Promise<string> {
  const response = await makeRequest<{ status: string; data: { avatarUrl: string } }>(
    `/events/${uuid}/person-avatar`,
    { method: "POST", body: imageFormData(file) },
    API_VERSION
  );
  if (!response?.data?.avatarUrl) throw new Error("Invalid response from person avatar API");
  return response.data.avatarUrl;
}

/** External co-hosts (accepted, pending and declined), in display order. */
export async function getCalEventCoHosts(uuid: string): Promise<CalEventCoHost[]> {
  const response = await makeRequest<{ status: string; data: CalEventCoHost[] }>(
    `/events/${uuid}/co-hosts`,
    {},
    API_VERSION
  );
  return Array.isArray(response?.data) ? response.data : [];
}

/** Invite a co-host by email. The invite link is valid for 7 days. */
export async function inviteCalEventCoHost(uuid: string, email: string): Promise<void> {
  await makeRequest<{ status: string }>(
    `/events/${uuid}/co-hosts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    },
    API_VERSION
  );
}

/** Reorder co-hosts. `coHostIds` must list every co-host once, else 400. */
export async function reorderCalEventCoHosts(uuid: string, coHostIds: string[]): Promise<void> {
  await makeRequest<{ status: string }>(
    `/events/${uuid}/co-hosts/order`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coHostIds }),
    },
    API_VERSION
  );
}

/** Remove a co-host, or cancel a pending invite. */
export async function removeCalEventCoHost(uuid: string, coHostId: string): Promise<void> {
  await makeRequest<{ status: string }>(
    `/events/${uuid}/co-hosts/${coHostId}`,
    { method: "DELETE" },
    API_VERSION
  );
}
