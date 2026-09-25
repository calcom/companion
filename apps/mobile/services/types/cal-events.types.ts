/**
 * Cal Events — one-off RSVP events (meetups, parties, conferences), as managed at
 * app.cal.com/events. Mirrors the `/v2/cal-events` API v2 output shape.
 */

export type CalEventStatus = "draft" | "published" | "past" | "cancelled";
export type CalEventVisibility = "PUBLIC" | "UNLISTED";
export type CalEventCategory = "meetup" | "conference" | "music" | "sports";
export type CalEventGuestListDisplay = "NAMES" | "COUNT";

export interface CalEventHost {
  userId: number;
  name: string | null;
  /** Only present on the single-event response. */
  username?: string | null;
  avatarUrl: string | null;
}

export interface CalEventLocation {
  id: string;
  /** `link` for a virtual event, `address` for an in-person one, or a conferencing app type. */
  type: string;
  address?: string;
  link?: string;
  customLabel?: string;
  /** Smallest currency unit; null = free. */
  price?: number | null;
  currency?: string | null;
  /** null = uncapped. */
  capacity?: number | null;
}

export interface CalEventLiveStream {
  provider: string;
  url: string;
}

export interface CalEvent {
  /** The event's identifier — the uuid of its underlying event type. */
  eventTypeUuid: string;
  eventTypeId: number;
  title: string;
  slug: string;
  description: string | null;
  publicUrl: string;
  status: CalEventStatus;
  /** ISO 8601, UTC. */
  startTime: string;
  /** ISO 8601, UTC. */
  endTime: string;
  /** The event's own timezone — in-person events display venue time, not the viewer's. */
  timeZone: string;
  category: CalEventCategory;
  coverImageUrl: string | null;
  mapImageUrl: string | null;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  locations: CalEventLocation[];
  liveStreams: CalEventLiveStream[];
  visibility: CalEventVisibility;
  requiresApproval: boolean;
  waitlistEnabled: boolean;
  showGuestList: boolean;
  guestListDisplay: CalEventGuestListDisplay;
  /** Smallest currency unit; null = free. */
  price: number | null;
  currency: string | null;
  /** Total seats; null = unlimited. */
  capacity: number | null;
  /** Confirmed registrations. Computed for the list endpoint only; null on the single-event response. */
  confirmedCount: number | null;
  /** Ordered host roster, creator first. */
  hosts: CalEventHost[];
  userId: number | null;
  teamId: number | null;
  /** True when the current user is an external co-host: may edit, may not publish/cancel/delete. */
  viewerIsCoHost: boolean;
  publishedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A team the user belongs to, from `/v2/teams`. */
export interface Team {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  parentId?: number;
}
