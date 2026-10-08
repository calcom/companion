/**
 * Presentation helpers for Cal Events: grouping, labels and date formatting.
 * Pure functions — mirrored from the web app's /events listing so both surfaces
 * read the same event the same way.
 */

import type { CalEvent, CalEventStatus, Team } from "@/services/types/cal-events.types";
import { getCalAppUrl, getCalWebUrl } from "@/utils/region";

export type CalEventsGroupKind = "drafts" | "upcoming" | "past";

export interface CalEventsGroup {
  kind: CalEventsGroupKind;
  events: CalEvent[];
}

export const CAL_EVENTS_GROUP_LABELS: Record<CalEventsGroupKind, string> = {
  drafts: "Drafts",
  upcoming: "Upcoming",
  past: "Past",
};

const startMs = (event: Pick<CalEvent, "startTime">) => new Date(event.startTime).getTime();

/**
 * Drafts first (soonest first), then upcoming (soonest first), then past (most recent first).
 * A cancelled event stays under "Upcoming" until its start passes, as on the web.
 */
export function groupCalEvents(events: CalEvent[], now: Date = new Date()): CalEventsGroup[] {
  const nowMs = now.getTime();
  const drafts = events.filter((e) => e.status === "draft").sort((a, b) => startMs(a) - startMs(b));
  const rest = events.filter((e) => e.status !== "draft");
  const isUpcoming = (e: CalEvent) =>
    e.status === "published" || (e.status === "cancelled" && startMs(e) >= nowMs);
  const upcoming = rest.filter(isUpcoming).sort((a, b) => startMs(a) - startMs(b));
  const past = rest.filter((e) => !isUpcoming(e)).sort((a, b) => startMs(b) - startMs(a));

  const groups: CalEventsGroup[] = [];
  if (drafts.length) groups.push({ kind: "drafts", events: drafts });
  if (upcoming.length) groups.push({ kind: "upcoming", events: upcoming });
  if (past.length) groups.push({ kind: "past", events: past });
  return groups;
}

export function filterCalEventsByTitle(events: CalEvent[], query: string): CalEvent[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return events;
  return events.filter((e) => e.title.toLowerCase().includes(needle));
}

/** The teams that get a profile chip: `/v2/teams` also lists the user's organizations. */
export function getCalEventsProfileTeams(teams: Team[]): Team[] {
  return teams.filter((team) => !team.isOrganization);
}

/** One per route the tab reads: `/v2/events`, `/v2/teams/{teamId}/events`, `/v2/teams` (chips). */
const CAL_EVENTS_READ_SCOPES = ["EVENT_READ", "TEAM_EVENT_READ", "TEAM_PROFILE_READ"];

/**
 * Whether an OAuth token's space-separated scope can read every Events listing, so a team's 403
 * means membership or role, never a missing scope. A refreshed token keeps the scopes of its
 * original sign-in, so tokens from before the Events tab never can; a token with no recorded
 * scope predates it too.
 */
export function canReadCalEvents(scope: string | null | undefined): boolean {
  const granted = scope?.split(" ") ?? [];
  return CAL_EVENTS_READ_SCOPES.every((required) => granted.includes(required));
}

/** Only OAuth sessions carry scopes: a web session (the extension) is never asked to sign in again. */
export function needsSignInAgainForCalEvents(session: {
  isWebSession: boolean;
  oauthScope: string | null;
}): boolean {
  return !session.isWebSession && !canReadCalEvents(session.oauthScope);
}

/** Same rule as the web listing: cancelled wins, then draft, then past once the end has passed. */
export function deriveCalEventStatus(
  event: Pick<CalEvent, "publishedAt" | "cancelledAt" | "endTime">,
  now: Date = new Date()
): CalEventStatus {
  if (event.cancelledAt) return "cancelled";
  if (!event.publishedAt) return "draft";
  if (new Date(event.endTime).getTime() < now.getTime()) return "past";
  return "published";
}

/**
 * The events with each status re-read at `now`. The status derived at fetch time stays in the
 * (persisted) cache, so an event that has ended since would still read as published, group as
 * upcoming and offer Cancel. An event whose status holds is returned as is.
 */
export function refreshCalEventStatuses(events: CalEvent[], now: Date = new Date()): CalEvent[] {
  return events.map((event) => {
    const status = deriveCalEventStatus(event, now);
    return status === event.status ? event : { ...event, status };
  });
}

export const CAL_EVENT_STATUS_LABELS: Record<CalEventStatus, string> = {
  draft: "Draft",
  published: "Published",
  past: "Past",
  cancelled: "Cancelled",
};

/** "Online" for virtual events, the venue address otherwise. */
export function getCalEventLocationLabel(event: Pick<CalEvent, "locationAddress">): string {
  return event.locationAddress?.trim() || "Online";
}

export function isCalEventInPerson(event: Pick<CalEvent, "locationAddress">): boolean {
  return !!event.locationAddress?.trim();
}

/** "€15.00", from the smallest currency unit. Falls back to "15.00 EURO" for a malformed code. */
export function formatCalEventPrice(price: number, currency: string | null): string {
  const amount = price / 100;
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/**
 * The facts a row states after the location, in order. Only what differs from the
 * default (free, public, unlimited, nobody going) — same rule as the web listing.
 */
export function getCalEventFacts(
  event: Pick<
    CalEvent,
    "capacity" | "confirmedCount" | "price" | "currency" | "visibility" | "waitlistEnabled"
  >
): string[] {
  const facts: string[] = [];
  const { capacity } = event;
  const confirmed = event.confirmedCount ?? 0;

  if (capacity !== null && confirmed >= capacity) {
    facts.push(`${confirmed}/${capacity} full`);
    facts.push(event.waitlistEnabled ? "Waitlist" : "Sold out");
  } else {
    if (confirmed > 0 || capacity !== null) facts.push(`${confirmed} going`);
    if (capacity !== null) facts.push(`${capacity} cap`);
  }

  if (event.price) facts.push(formatCalEventPrice(event.price, event.currency));
  if (event.visibility === "UNLISTED") facts.push("Unlisted");

  return facts;
}

type DateParts = { year: string; month: string; day: string; weekday: string };

function partsIn(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), weekday: get("weekday") };
}

function safeParts(date: Date, timeZone: string): DateParts {
  try {
    return partsIn(date, timeZone);
  } catch {
    // An unknown IANA zone on this device: fall back to UTC rather than crash the row.
    return partsIn(date, "UTC");
  }
}

/**
 * Date line for a row, in the EVENT's timezone: "Sat, Oct 10", or "Fri, Oct 30 – Sun, Nov 1"
 * for a multi-day event. The year is appended only when the event is not in the current one.
 */
export function formatCalEventDate(
  startIso: string,
  endIso: string,
  timeZone: string,
  now: Date = new Date()
): string {
  const start = safeParts(new Date(startIso), timeZone);
  const end = safeParts(new Date(endIso), timeZone);
  const currentYear = safeParts(now, timeZone).year;
  const withYear = start.year !== currentYear || end.year !== currentYear;
  const fmt = (p: DateParts) => `${p.weekday}, ${p.month} ${p.day}${withYear ? `, ${p.year}` : ""}`;
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  return sameDay ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

/** Start time in the event's timezone: "4:00 PM". */
export function formatCalEventTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
}

/** "4:00 PM – 9:00 PM" */
export function formatCalEventTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string
): string {
  return `${formatCalEventTime(startIso, timeZone)} – ${formatCalEventTime(endIso, timeZone)}`;
}

/** The public event page, root namespace: `{webUrl}/{slug}` — the same rule as the web listing. */
export function getCalEventPublicUrl(slug: string): string {
  return `${getCalWebUrl()}/${slug}`;
}

/** The web editor for an event (the app has no editor of its own). */
export function getCalEventEditorUrl(uuid: string): string {
  return `${getCalAppUrl()}/events/${uuid}`;
}

/**
 * Whether the viewer may publish/cancel/delete: the event's owner or one of its hosts. The API's
 * host roster leaves out external co-hosts, and an unknown viewer (profile not loaded) may not.
 */
export function canManageCalEventLifecycle(
  event: Pick<CalEvent, "userId" | "hosts">,
  viewerId: number | undefined
): boolean {
  if (viewerId === undefined) return false;
  return event.userId === viewerId || event.hosts.some((host) => host.userId === viewerId);
}

/**
 * Whether the server will accept a delete: never a published paid event (its payment records are
 * kept), and only without confirmed guests. A draft can't have any, and a cancelled event's
 * confirmedCount still counts the cancelled booking's seats, which the server ignores. Otherwise a
 * missing count (the single-event response has none) is unknown, not zero.
 */
export function canDeleteCalEvent(
  event: Pick<CalEvent, "publishedAt" | "price" | "status" | "confirmedCount">
): boolean {
  if (event.publishedAt && event.price) return false;
  if (event.status === "draft" || event.status === "cancelled") return true;
  return event.confirmedCount === 0;
}

/** A row's status badge colors, matching the web variants (warning/success/secondary/error). */
export function getCalEventStatusColors(
  status: CalEventStatus,
  isDark: boolean
): { background: string; text: string } {
  switch (status) {
    case "draft":
      return isDark
        ? { background: "#3D2E00", text: "#FFD60A" }
        : { background: "#FEF3C7", text: "#92400E" };
    case "published":
      return isDark
        ? { background: "#0B3D1F", text: "#4ADE80" }
        : { background: "#DCFCE7", text: "#166534" };
    case "cancelled":
      return isDark
        ? { background: "#3F1212", text: "#F87171" }
        : { background: "#FEE2E2", text: "#991B1B" };
    default:
      return isDark
        ? { background: "#262626", text: "#A3A3A3" }
        : { background: "#F3F4F6", text: "#4B5563" };
  }
}

/**
 * A title short enough for the navigation bar: at most `max` characters, the last one "…".
 * Counts code points, not UTF-16 units, so an emoji at the cutoff is kept or dropped whole rather
 * than halved into "�" (Hermes has no Intl.Segmenter to count graphemes).
 */
export function truncateCalEventTitle(title: string, max = 28): string {
  const characters = Array.from(title);
  return characters.length > max ? `${characters.slice(0, max - 1).join("")}…` : title;
}
