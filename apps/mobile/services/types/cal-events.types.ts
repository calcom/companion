/**
 * Cal Events — one-off RSVP events (meetups, parties, conferences), as managed at
 * app.cal.com/events. Mirrors the `/v2/events` API v2 output, plus a few fields the
 * app derives once per fetch (see services/calcom/cal-events.ts).
 */

export type CalEventStatus = "draft" | "published" | "past" | "cancelled";
export type CalEventVisibility = "PUBLIC" | "UNLISTED";

export interface CalEventHost {
  userId: number;
  name: string | null;
  /** Only present on the single-event response. */
  username?: string | null;
  avatarUrl: string | null;
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
  /** True when the current user is an external co-host: may edit, may not publish/cancel/delete. Listing only. */
  viewerIsCoHost?: boolean;
  /** Ordered host roster, creator first. */
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

/** A team the user belongs to, from `/v2/teams`. */
export interface Team {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  parentId?: number;
}
