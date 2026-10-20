/**
 * Cal Events functions for Cal.com API (`/v2/events`)
 */

import { deriveCalEventStatus, getCalEventPublicUrl } from "@/utils/cal-events";

import type {
  AddCalEventLocationInput,
  ApproveAllCalEventRegistrationsInput,
  CalEvent,
  CalEventApi,
  CalEventApproveAllResult,
  CalEventBookingApi,
  CalEventCheckInList,
  CalEventCheckInOutcomeApi,
  CalEventCheckInResult,
  CalEventCoHost,
  CalEventGuest,
  CalEventInvitationResult,
  CalEventLocation,
  CalEventMessage,
  CalEventMessageSendResult,
  CalEventMessagesPage,
  CalEventRegistrationApi,
  CalEventRegistrationCounts,
  CalEventRegistrationDecision,
  CalEventRegistrationStatus,
  CalEventRosterGuest,
  CalEventsListingStatus,
  CalEventsPage,
  CalEventTicketCheckInResult,
  CalEventUndoCheckInOutcomeApi,
  CreateCalEventInput,
  InviteCalEventGuestsInput,
  SendCalEventMessageInput,
  UpdateCalEventInput,
  UpdateCalEventLocationInput,
} from "../types";

import { ApiRequestError, makeRequest } from "./request";

const API_VERSION = "2024-06-14";
/** From this version on, the listings page with `limit` + `cursor` and filter by `status`. */
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
 * Get one page of a listing group (`status`) of the events the authenticated user hosts (own +
 * co-hosted), or of every event a team owns when `teamId` is given. Omit `cursor` for the group's
 * first page. 403 on a team the user isn't an accepted member of.
 */
export async function getCalEvents(
  teamId: number | null | undefined,
  status: CalEventsListingStatus,
  cursor?: string | null
): Promise<CalEventsPage> {
  const params = new URLSearchParams({ status, limit: String(CAL_EVENTS_PAGE_SIZE) });
  // A cursor only continues the status it came from: another status gets a 400.
  if (cursor) params.append("cursor", cursor);
  const endpoint = `${teamId ? `/teams/${teamId}/events` : "/events"}?${params.toString()}`;
  const response = await makeRequest<ListResponse>(endpoint, {}, LIST_API_VERSION);
  const now = new Date();
  const events = Array.isArray(response?.data)
    ? response.data.map((event) => toCalEvent(event, now))
    : [];
  const nextCursor = response?.pagination?.nextCursor ?? null;
  // Without a cursor there is no way to ask for the next page, whatever `hasMore` says.
  return {
    status,
    events,
    nextCursor,
    hasMore: !!response?.pagination?.hasMore && nextCursor !== null,
  };
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
 * Add one location after the existing ones. One address per event, and on a published event the
 * guests are emailed about it.
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

/**
 * Change a location's fields and keep its id. Its type can't change, and on a published event
 * neither can its price; the guests are emailed about the change.
 */
export async function updateCalEventLocation(
  uuid: string,
  locationId: string,
  patch: UpdateCalEventLocationInput
): Promise<CalEventLocation> {
  const response = await makeRequest<{ status: string; data: CalEventLocation }>(
    `/events/${uuid}/locations/${locationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from update location API");
  return response.data;
}

/**
 * Remove a location; returns the ones left. A published paid event can't remove any, and on a
 * published event the guests are emailed.
 */
export async function removeCalEventLocation(
  uuid: string,
  locationId: string
): Promise<CalEventLocation[]> {
  const response = await makeRequest<{ status: string; data: CalEventLocation[] }>(
    `/events/${uuid}/locations/${locationId}`,
    { method: "DELETE" },
    API_VERSION
  );
  if (!Array.isArray(response?.data)) throw new Error("Invalid response from remove location API");
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

/** The API's largest page, so a big guest list takes as few calls as it can. */
const BOOKINGS_PAGE_SIZE = 250;

/** The statuses the tab lists: the same ones as the web's "All". */
const ROSTER_STATUSES: CalEventRegistrationStatus[] = [
  "PENDING_APPROVAL",
  "WAITLISTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "DECLINED",
  "CANCELLED",
];

type BookingsResponse = {
  status: string;
  data: CalEventBookingApi[];
  pagination?: { nextCursor: string | null; hasMore: boolean };
};

/** The app's view of a guest: the one place the roster's API shape is read. */
export function toCalEventRosterGuest(booking: CalEventBookingApi): CalEventRosterGuest {
  const responses = booking.responses;
  return {
    registrationId: booking.registrationId,
    status: booking.status ?? "CONFIRMED",
    name: booking.name ?? "",
    email: booking.email ?? "",
    phoneNumber: booking.phoneNumber ?? null,
    rsvpResponse: booking.rsvpResponse,
    responses:
      responses && typeof responses === "object" && !Array.isArray(responses)
        ? (responses as Record<string, unknown>)
        : {},
    locationId: booking.locationId ?? null,
    createdAt: booking.createdAt,
    checkedInAt: booking.checkedInAt ?? null,
    avatarUrl: booking.avatarUrl ?? null,
    payment: booking.payment ?? null,
    noShow: booking.noShow ?? false,
    decidedAt: booking.decidedAt ?? null,
  };
}

/**
 * Every guest of an event in the statuses the tab lists, read page by page: the tab's counts,
 * filters and pages all need the whole list.
 */
export async function getCalEventRoster(uuid: string): Promise<CalEventRosterGuest[]> {
  // By id, so a guest a later page repeats is listed (and counted) once.
  const guests = new Map<string, CalEventRosterGuest>();
  const followed = new Set<string>();
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({
      limit: String(BOOKINGS_PAGE_SIZE),
      status: ROSTER_STATUSES.join(","),
    });
    if (cursor) params.append("cursor", cursor);
    const response: BookingsResponse = await makeRequest<BookingsResponse>(
      `/events/${uuid}/bookings?${params.toString()}`,
      {},
      API_VERSION
    );
    for (const booking of Array.isArray(response?.data) ? response.data : []) {
      if (!guests.has(booking.registrationId)) {
        guests.set(booking.registrationId, toCalEventRosterGuest(booking));
      }
    }
    // No cursor to follow is the end, and so is one already followed: it would loop forever.
    const next = response?.pagination?.hasMore ? response.pagination.nextCursor : null;
    cursor = next && !followed.has(next) ? next : null;
    if (cursor) followed.add(cursor);
  } while (cursor);
  return [...guests.values()];
}

/**
 * How many of an event's guests are in each status, answered each RSVP, are checked in and hold a
 * seat at each location. Counts the whole event, not just the pages loaded.
 */
export async function getCalEventRegistrationCounts(
  uuid: string
): Promise<CalEventRegistrationCounts> {
  const response = await makeRequest<{ status: string; data: CalEventRegistrationCounts }>(
    `/events/${uuid}/registrations/counts`,
    {},
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from registration counts API");
  return response.data;
}

/**
 * Email invitations to register. Published events that haven't started only, up to 200 active
 * invitations per event; the inviter needs a verified email (else 403).
 */
export async function inviteCalEventGuests(
  uuid: string,
  input: InviteCalEventGuestsInput
): Promise<CalEventInvitationResult> {
  const hostNote = input.hostNote?.trim();
  const response = await makeRequest<{ status: string; data: CalEventInvitationResult }>(
    `/events/${uuid}/invitations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        hostNote ? { emails: input.emails, hostNote } : { emails: input.emails }
      ),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from invite guests API");
  return { ...response.data, outcomes: response.data.outcomes ?? [] };
}

/**
 * Email one group of the event's guests (phone-only guests get a text). Hosts only: co-hosts get
 * the same 404 as an unknown event. 400 when the group has nobody to email.
 */
export async function sendCalEventMessage(
  uuid: string,
  input: SendCalEventMessageInput
): Promise<CalEventMessageSendResult> {
  const response = await makeRequest<{ status: string; data: CalEventMessageSendResult }>(
    `/events/${uuid}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    API_VERSION
  );
  if (!response?.data) throw new Error("Invalid response from message guests API");
  return response.data;
}

/** One page (20) of the messages sent to the event's guests, newest first. Hosts only. */
export async function getCalEventMessages(
  uuid: string,
  cursor?: string | null
): Promise<CalEventMessagesPage> {
  const query = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : "";
  const response = await makeRequest<{
    status: string;
    data: CalEventMessage[];
    pagination?: { nextCursor: string | null; hasMore: boolean };
  }>(`/events/${uuid}/messages${query}`, {}, API_VERSION);
  const nextCursor = response?.pagination?.nextCursor ?? null;
  return {
    messages: Array.isArray(response?.data) ? response.data : [],
    nextCursor: response?.pagination?.hasMore ? nextCursor : null,
  };
}

/**
 * Approve every guest waiting for approval, in registration order, narrowed by `search` and
 * `locationId` like the list. A full event leaves the rest pending; a paid one runs in the
 * background, sending each guest a payment link.
 */
export async function approveAllCalEventRegistrations(
  uuid: string,
  input: ApproveAllCalEventRegistrationsInput = {}
): Promise<CalEventApproveAllResult> {
  const body: ApproveAllCalEventRegistrationsInput = {};
  const search = input.search?.trim();
  if (search) body.search = search;
  if (input.locationId) body.locationId = input.locationId;
  const response = await makeRequest<{
    status: string;
    data: {
      kind: "completed" | "started";
      approvedCount?: number;
      notSeatedCount?: number;
      total?: number;
    };
  }>(
    `/events/${uuid}/registrations/approve-all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    API_VERSION
  );
  const outcome = response?.data;
  if (outcome?.kind === "completed") {
    return {
      kind: "completed",
      approvedCount: outcome.approvedCount ?? 0,
      notSeatedCount: outcome.notSeatedCount ?? 0,
    };
  }
  if (outcome?.kind === "started") return { kind: "started", total: outcome.total ?? 0 };
  throw new Error("Invalid response from approve all API");
}

async function decideCalEventRegistration(
  uuid: string,
  registrationId: string,
  decision: "approve" | "decline"
): Promise<CalEventRegistrationDecision> {
  const response = await makeRequest<{ status: string; data: { kind?: string } }>(
    `/events/${uuid}/registrations/${registrationId}/${decision}`,
    { method: "POST" },
    API_VERSION
  );
  const kind = response?.data?.kind;
  if (!kind) throw new Error(`Invalid response from ${decision} API`);
  return kind;
}

/**
 * Approve one guest waiting for approval. A free Event seats them unless it's full; a paid one
 * sends them a payment request instead.
 */
export function approveCalEventRegistration(
  uuid: string,
  registrationId: string
): Promise<CalEventRegistrationDecision> {
  return decideCalEventRegistration(uuid, registrationId, "approve");
}

/** Decline one guest waiting for approval or on the waitlist. The API emails them. */
export function declineCalEventRegistration(
  uuid: string,
  registrationId: string
): Promise<CalEventRegistrationDecision> {
  return decideCalEventRegistration(uuid, registrationId, "decline");
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
 * Get every confirmed guest of an event, page by page: the count, search and A–Z order all need
 * the whole list. Hosts, accepted co-hosts and team members with access only; anyone else gets the
 * same 404 as for an unknown event.
 */
export async function getCalEventGuests(uuid: string): Promise<CalEventCheckInList> {
  // By id, so a guest a later page repeats is listed (and counted) once.
  const guests = new Map<string, CalEventGuest>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response: BookingsResponse = await makeRequest<BookingsResponse>(
      `/events/${uuid}/bookings?limit=${BOOKINGS_PAGE_SIZE}${query}`,
      {},
      API_VERSION
    );
    for (const booking of Array.isArray(response?.data) ? response.data : []) {
      const guest = toCalEventGuest(booking);
      if (!guests.has(guest.id)) guests.set(guest.id, guest);
    }
    // No cursor to follow is the end, and so is one already followed: it would loop forever.
    const next = response?.pagination?.hasMore ? response.pagination.nextCursor : null;
    cursor = next && !cursors.has(next) ? next : null;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { guests: [...guests.values()] };
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
  if (outcome.kind === "checked_in") {
    return { kind: outcome.kind, checkedInAt: outcome.registration?.checkedInAt ?? undefined };
  }
  return outcome.kind === "already_checked_in"
    ? { kind: outcome.kind, checkedInAt: outcome.checkedInAt }
    : { kind: outcome.kind };
}

/** A registration from the check-in endpoints, as the guest list shows it. */
function registrationToCalEventGuest(registration: CalEventRegistrationApi): CalEventGuest {
  return {
    id: registration.id,
    name: registration.name,
    email: registration.email,
    phoneNumber: registration.phoneNumber ?? null,
    checkedInAt: registration.checkedInAt ?? null,
  };
}

/**
 * Check a guest in from their scanned QR ticket. The token goes in the body, since URLs land in
 * logs. A forged ticket and one for another event get the same 404 as an unknown guest; 400 on a
 * cancelled event, or outside its check-in window.
 */
export async function checkInCalEventGuestByTicket(
  uuid: string,
  checkInToken: string
): Promise<CalEventTicketCheckInResult> {
  const response = await makeRequest<{ status: string; data: CalEventCheckInOutcomeApi }>(
    `/events/${uuid}/check-ins`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInToken }),
    },
    API_VERSION
  );
  const outcome = response?.data;
  if (outcome?.kind === "not_confirmed") return { kind: outcome.kind };
  if (!outcome?.kind || !outcome.registration) {
    throw new Error("Invalid response from check-in API");
  }
  const guest = registrationToCalEventGuest(outcome.registration);
  return outcome.kind === "already_checked_in"
    ? { kind: outcome.kind, guest, checkedInAt: outcome.checkedInAt }
    : { kind: outcome.kind, guest };
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
