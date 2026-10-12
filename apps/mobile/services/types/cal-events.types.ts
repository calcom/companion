/**
 * Cal Events — one-off RSVP events (meetups, parties, conferences), as managed at
 * app.cal.com/events. Mirrors the `/v2/events` API v2 output, plus a few fields the
 * app derives once per fetch (see services/calcom/cal-events.ts).
 */

export type CalEventStatus = "draft" | "published" | "past" | "cancelled";
export type CalEventVisibility = "PUBLIC" | "UNLISTED";

export interface CalEventHost {
  userId: number;
  /** Empty when the host has no name. */
  name: string;
  /** Only present on the single-event response. */
  username?: string | null;
  /** Empty when the host has no avatar. */
  avatarUrl: string;
}

export type CalEventLocation =
  | { type: "address"; address: string }
  | { type: "link"; link: string }
  | { type: "integration"; integration: string; credentialId?: number }
  | { type: "organizersDefaultApp" };

/** One event as `/v2/events` returns it. Date fields are ISO 8601 strings in UTC. */
export interface CalEventApi {
  uuid: string;
  slug: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  /** The event's own timezone — in-person events display venue time, not the viewer's. */
  timeZone: string;
  visibility: CalEventVisibility;
  hidden: boolean;
  publishedAt: string | null;
  cancelledAt: string | null;
  locations: CalEventLocation[];
  coverImageUrl: string | null;
  requiresApproval: boolean;
  waitlistEnabled: boolean;
  /** Confirmed registrations. Present on the listing, absent on the single-event response. */
  confirmedCount?: number;
  /** Ordered host roster, creator first. External co-hosts are not included. */
  hosts: CalEventHost[];
  /** Total seats; null = unlimited. */
  capacity: number | null;
  /** Smallest currency unit; null = free. */
  price: number | null;
  currency: string | null;
  cancellationReason: string | null;
  userId: number | null;
  teamId: number | null;
}

export interface CalEvent extends CalEventApi {
  /** Derived from publishedAt / cancelledAt / endTime at fetch time. */
  status: CalEventStatus;
  /** The first address location, or null for a virtual event. */
  locationAddress: string | null;
  /** The public event page, `{webUrl}/{slug}`. */
  publicUrl: string;
}

export type CalEventRsvpResponse = "YES" | "NO" | "MAYBE";

export type CalEventRegistrationStatus =
  | "PENDING_APPROVAL"
  | "WAITLISTED"
  | "PENDING_PAYMENT"
  | "OFFER_EXPIRED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED";

/**
 * One confirmed guest as `GET /v2/events/{uuid}/bookings` returns it: a seat on the Event's
 * booking. Date fields are ISO 8601 strings.
 */
export interface CalEventBookingApi {
  type: "event";
  /** The id the check-in endpoints take. */
  registrationId: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  rsvpResponse: CalEventRsvpResponse;
  /** Registration-form answers. */
  responses?: unknown;
  locationId?: string | null;
  createdAt: string;
  /** When a door check-in was recorded. */
  checkedInAt?: string | null;
  /** Host who recorded the door check-in. */
  checkedInByUserId?: number | null;
}

/** `GET /v2/events/{uuid}/bookings` pagination: pass `nextCursor` back as `cursor`. */
export interface CalEventsCursorPaginationApi {
  nextCursor: string | null;
  hasMore: boolean;
}

/** A registration as the check-in endpoints return it. */
export interface CalEventRegistrationApi {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  status: CalEventRegistrationStatus;
  rsvpResponse: CalEventRsvpResponse;
  responses?: unknown;
  locationId?: string | null;
  createdAt: string;
  checkedInAt?: string | null;
  checkedInByUserId?: number | null;
}

/** `POST /v2/events/{uuid}/registrations/{registrationId}/check-in` */
export type CalEventCheckInOutcomeApi =
  | { kind: "checked_in"; registration: CalEventRegistrationApi }
  | { kind: "already_checked_in"; registration: CalEventRegistrationApi; checkedInAt: string }
  | { kind: "not_confirmed"; status: CalEventRegistrationStatus };

/** `DELETE /v2/events/{uuid}/registrations/{registrationId}/check-in`: idempotent. */
export type CalEventUndoCheckInOutcomeApi =
  | { kind: "undone"; registration: CalEventRegistrationApi }
  | { kind: "not_checked_in" };

/** A confirmed guest on an Event's check-in list. */
export interface CalEventGuest {
  /** What the check-in and undo calls take. */
  id: string;
  /** Empty when the guest gave none. */
  name: string;
  email: string;
  phoneNumber: string | null;
  /** ISO 8601; null until the guest is checked in. */
  checkedInAt: string | null;
}

export interface CalEventGuestsPage {
  guests: CalEventGuest[];
  /** More confirmed guests follow this page. */
  hasMore: boolean;
}

/**
 * What a check-in did. `already_checked_in` means another host (or a scan) got there first;
 * `not_confirmed` means the guest's registration is no longer confirmed, so nothing was recorded.
 */
export type CalEventCheckInResult =
  | { kind: "checked_in"; checkedInAt?: string }
  | { kind: "already_checked_in"; checkedInAt: string }
  | { kind: "not_confirmed" };

/** A team the user belongs to, from `/v2/teams`: organizations and pending memberships included. */
export interface Team {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  parentId?: number;
  isOrganization: boolean;
}
