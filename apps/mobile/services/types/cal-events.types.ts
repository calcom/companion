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

/** What every location carries besides its kind. Present on responses, never required on input. */
interface CalEventLocationDetails {
  /** Minted by the server; stable across reads. */
  id?: string;
  label?: string | null;
  /** Smallest currency unit; null = free. */
  price?: number | null;
  currency?: string | null;
  /** Seats at this location; unset = no own limit. */
  capacity?: number | null;
}

export type CalEventLocation = CalEventLocationDetails &
  (
    | { type: "address"; address: string }
    | { type: "link"; link: string }
    | { type: "integration"; integration: string; credentialId?: number }
    | { type: "organizersDefaultApp" }
    /** One this API version can't represent; `location` is the stored JSON. */
    | { type: "unknown"; location: string }
  );

export type CalEventCategory = "meetup" | "conference" | "music" | "sports";
export type CalEventTheme = "light" | "dark";
export type CalEventGuestList = "hidden" | "names" | "count";

export type CalEventShaderId =
  | "aurora"
  | "tide"
  | "satin"
  | "resonance"
  | "veil"
  | "facet"
  | "lumen"
  | "contour"
  | "recess"
  | "halftone"
  | "strata";

/** The animated background of the event page. */
export interface CalEventBackground {
  effect: CalEventShaderId;
  /** Exactly three `#rrggbb` colors. */
  colors: [string, string, string];
}

export interface CalEventLink {
  url: string;
}

export interface CalEventLineupPerson {
  name: string;
  role?: string | null;
  /** Only a URL returned by the person avatar endpoint. */
  avatarUrl?: string | null;
  links?: CalEventLink[];
  media?: { url: string; label?: string | null }[];
}

export interface CalEventLineup {
  title?: string | null;
  people: CalEventLineupPerson[];
}

export type CalEventSchedulePerson = Omit<CalEventLineupPerson, "media">;

/** An agenda item: a startTime (ISO 8601, UTC) or, without one, a free-text timeLabel. */
export interface CalEventScheduleItem {
  startTime?: string | null;
  endTime?: string | null;
  timeLabel?: string | null;
  content: string;
  people?: CalEventSchedulePerson[];
}

/**
 * A registration question in the 2026-06-12 booking-field shape. The response echoes the input
 * shape, so fields round-trip as they are; only what the editor changes is typed.
 */
export interface CalEventRegistrationField {
  /** "custom" for the host's own questions, else the system field it is ("name", "email", …). */
  field: string;
  /** Custom questions only. */
  type?: CalEventCustomFieldType;
  slug?: string;
  label?: string;
  required?: boolean;
  hidden?: boolean;
  placeholder?: string;
  /** Select, multi-select, checkbox group and radio group questions. */
  options?: string[];
  [key: string]: unknown;
}

export type CalEventCustomFieldType =
  | "shortText"
  | "longText"
  | "number"
  | "email"
  | "phone"
  | "address"
  | "url"
  | "select"
  | "multiSelect"
  | "multiEmail"
  | "checkboxGroup"
  | "radioGroup"
  | "checkbox";

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
  /**
   * Smallest currency unit; null = free. Set only on an event without locations: one with
   * locations is priced per location.
   */
  price: number | null;
  currency: string | null;
  /**
   * Whether paid events are available (the `cal-events-payments` flag). When false, a price on the
   * event or a location is rejected. Absent from servers that predate it.
   */
  paymentsEnabled?: boolean;
  cancellationReason: string | null;
  userId: number | null;
  teamId: number | null;
  // The editor's fields. Optional: only the single-event response is sure to carry them all.
  category?: CalEventCategory;
  /** null follows the visitor's system setting. */
  theme?: CalEventTheme | null;
  background?: CalEventBackground | null;
  liveStreams?: CalEventLink[];
  lineup?: CalEventLineup | null;
  schedule?: CalEventScheduleItem[] | null;
  registrationFields?: CalEventRegistrationField[];
  guestList?: CalEventGuestList;
  showOrganizerEmail?: boolean;
  showPresentedBy?: boolean;
  /** Minutes a seat is held while the guest pays; null = the 10-minute default. */
  paymentTimeoutMinutes?: number | null;
}

export interface CalEvent extends CalEventApi {
  /** Derived from publishedAt / cancelledAt / endTime at fetch time. */
  status: CalEventStatus;
  /** The first address location, or null for a virtual event. */
  locationAddress: string | null;
  /** The public event page, `{webUrl}/{slug}`. */
  publicUrl: string;
}

/**
 * The body of `POST /v2/events` (or `/v2/teams/{teamId}/events`) as the create screen sends it:
 * the web's create step, nothing more. The event is created as a draft.
 */
export interface CreateCalEventInput {
  title: string;
  /** ISO 8601 in UTC. */
  startTime: string;
  /** ISO 8601 in UTC, after startTime. */
  endTime: string;
  timeZone: string;
  visibility: CalEventVisibility;
  requiresApproval: boolean;
  /** Omitted when empty: the server then adds Cal Video. */
  locations?: Extract<CalEventLocation, { type: "address" } | { type: "link" }>[];
}

/**
 * The body of `PATCH /v2/events/{uuid}`: only what changed. Lists (hosts, liveStreams,
 * registrationFields, lineup, schedule) replace the stored list, so they go whole. Locations
 * have their own endpoint.
 */
export interface UpdateCalEventInput {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string;
  timeZone?: string;
  /** Locked once published. */
  slug?: string;
  visibility?: CalEventVisibility;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  paymentTimeoutMinutes?: number | null;
  /** Smallest currency unit; null makes the event free. Only for an event without locations. */
  price?: number | null;
  /** Required with a price. */
  currency?: string;
  requiresApproval?: boolean;
  showOrganizerEmail?: boolean;
  /** Locked once published. */
  guestList?: CalEventGuestList;
  showPresentedBy?: boolean;
  theme?: CalEventTheme | null;
  background?: CalEventBackground | null;
  category?: CalEventCategory;
  hosts?: { userId: number }[];
  liveStreams?: CalEventLink[];
  registrationFields?: CalEventRegistrationField[];
  lineup?: CalEventLineup | null;
  schedule?: CalEventScheduleItem[];
}

/** The body of `POST /v2/events/{uuid}/locations`: one address or link. */
export type AddCalEventLocationInput = Extract<
  CalEventLocation,
  { type: "address" } | { type: "link" }
>;

/**
 * The body of `PATCH /v2/events/{uuid}/locations/{locationId}`: only what changed. `type` must
 * match the stored one; null removes a label, price (and its currency) or capacity.
 */
export type UpdateCalEventLocationInput = {
  type: Exclude<CalEventLocation["type"], "unknown">;
  label?: string | null;
  price?: number | null;
  currency?: string;
  capacity?: number | null;
  address?: string;
  link?: string;
};

/** An external co-host, invited by email. */
export interface CalEventCoHost {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | (string & {});
  name: string | null;
  avatarUrl: string | null;
}

/**
 * One group of a listing, as `status` on `GET /v2/events` filters it. Drafts and upcoming come
 * soonest first, past latest first, so each group's next page goes below the one before.
 */
export type CalEventsListingStatus = "draft" | "upcoming" | "past";

/**
 * One page of a listing group. Pass `nextCursor` back, with the same `status`, for the group's
 * next page; it is null on the group's last one.
 */
export interface CalEventsPage {
  status: CalEventsListingStatus;
  events: CalEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** A team the user belongs to, from `/v2/teams`: organizations and pending memberships included. */
export interface Team {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  parentId?: number;
  isOrganization: boolean;
}

export type CalEventRsvpResponse = "YES" | "NO" | "MAYBE";

/**
 * One confirmed guest as `GET /v2/events/{uuid}/bookings` returns it. Only confirmed guests are
 * listed: pending, waitlisted and declined ones aren't. Date fields are ISO 8601 strings.
 */
export interface CalEventBookingApi {
  type: "event";
  registrationId: string;
  /** Empty when the guest gave none. */
  name: string;
  /** A placeholder `@sms.cal.com` address for a guest who registered by phone. */
  email: string;
  phoneNumber?: string | null;
  rsvpResponse: CalEventRsvpResponse;
  /** Registration-form answers, keyed by the field's name. */
  responses?: unknown;
  locationId?: string | null;
  createdAt: string;
  checkedInAt?: string | null;
  checkedInByUserId?: number | null;
}

/** A confirmed guest on an Event's Guests tab. */
export interface CalEventRosterGuest {
  registrationId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  rsvpResponse: CalEventRsvpResponse;
  responses: Record<string, unknown>;
  locationId: string | null;
  createdAt: string;
  checkedInAt: string | null;
}

/** The body of `POST /v2/events/{uuid}/invitations`. */
export interface InviteCalEventGuestsInput {
  /** 1 to 200. */
  emails: string[];
  /** Up to 500 characters, shown in the invitation email. */
  hostNote?: string;
}

export type CalEventInvitationReason =
  | "invited"
  | "already-invited"
  | "already-registered"
  | "cooldown"
  | "invalid-format"
  | "undeliverable"
  | "duplicate"
  | "failed"
  | (string & {});

/** What `POST /v2/events/{uuid}/invitations` did, with one outcome per submitted address. */
export interface CalEventInvitationResult {
  invitedCount: number;
  skippedAlreadyInvited: number;
  skippedAlreadyRegistered: number;
  skippedOnCooldown: number;
  skippedInvalid: number;
  /** Failed to send; inviting them again retries. */
  failedCount: number;
  outcomes: { email: string; reason: CalEventInvitationReason }[];
}

/** Who a message goes to: confirmed guests going or maybe, or guests awaiting approval. */
export type CalEventMessageSegment = "GOING" | "MAYBE" | "PENDING";

/** The body of `POST /v2/events/{uuid}/messages`. Plain text only. */
export interface SendCalEventMessageInput {
  segment: CalEventMessageSegment;
  /** Up to 200 characters. */
  subject: string;
  /** Up to 5000 characters. */
  body: string;
  locationId?: string;
  /** true = only checked-in guests, false = only those not checked in; omit for both. */
  checkedIn?: boolean;
}

export interface CalEventMessageSendResult {
  id: string;
  status: "QUEUED" | "FAILED_TO_QUEUE" | (string & {});
  /** Guests to be emailed. */
  recipientCount: number;
  /** Phone-only guests to be texted instead. */
  textRecipientCount: number;
  /** Phone-only guests who won't get it. */
  skippedPhoneCount: number;
}

export type CalEventMessageStatus =
  | "SENDING"
  | "SENT"
  | "PARTIALLY_SENT"
  | "NOT_SENT"
  | "NOT_SENT_EVENT_UNSENDABLE"
  | (string & {});

/** A message sent to an Event's guests, as `GET /v2/events/{uuid}/messages` lists it. */
export interface CalEventMessage {
  id: string;
  segment: CalEventMessageSegment;
  createdAt: string;
  /** null once the sender's account is deleted. */
  sender: { id: number; name: string | null } | null;
  status: CalEventMessageStatus;
  /** null while sending, or when nothing was delivered. */
  counts: {
    sentCount: number;
    failedCount: number;
    skippedPhoneCount: number;
    skippedUnsubscribedCount: number;
  } | null;
}

/** One page of sent messages, newest first. Pass `nextCursor` back for the next. */
export interface CalEventMessagesPage {
  messages: CalEventMessage[];
  nextCursor: string | null;
}

/** The body of `POST /v2/events/{uuid}/registrations/approve-all`: narrows who is approved. */
export interface ApproveAllCalEventRegistrationsInput {
  search?: string;
  locationId?: string;
}

/**
 * What approve all did. A free Event approves at once (`completed`); a paid one sends payment
 * requests in the background (`started`).
 */
export type CalEventApproveAllResult =
  | { kind: "completed"; approvedCount: number; notSeatedCount: number }
  | { kind: "started"; total: number };
