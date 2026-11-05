import { CAL_APP_HOSTNAMES, getCalWebUrl } from "./region";

/**
 * Cal Video links.
 *
 * A room is addressed as `https://cal.video/<slug>` at the root, or `https://<org>.cal.video/<slug>`
 * inside an organization — `i.cal.video/peer` is the member `peer` of the org `i`, `i.cal.video/sales`
 * that org's `sales` team. The host decides the namespace, so it travels with the slug everywhere.
 *
 * A booking's meeting is addressed as `https://app.cal.com/video/<booking uid>` (or the marketing
 * host, or the EU cluster). That page decides what the uid means today — not started, ended,
 * rescheduled, or a room — so the app asks it before joining anything.
 *
 * The same shapes are accepted through the app's own scheme, for places that cannot open a
 * universal link (simulators, notification payloads, tests):
 *   `calcom://video?url=https%3A%2F%2Fi.cal.video%2Fpeer`
 *   `calcom://video/i.cal.video/peer`
 */

/** Apex hosts whose paths are room slugs. */
const CAL_VIDEO_APEX_HOSTS: readonly string[] = ["cal.video"];

/** Hosts whose `/video/<uid>` path is a booking's meeting, across both regions. */
const BOOKING_VIDEO_HOSTNAMES: ReadonlySet<string> = new Set([
  ...CAL_APP_HOSTNAMES,
  new URL(getCalWebUrl("us")).hostname,
  new URL(getCalWebUrl("eu")).hostname,
]);

/** Booking uids are short ids or dashed UUIDs; the web caps them at 64. */
const BOOKING_UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Mirrors the web app's `room-slug-policy`: lowercase labels joined by single hyphens, 64 max. */
const MAX_SLUG_LENGTH = 64;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Paths the web app owns. A link to `cal.video/login` is a page, not a room, and opening it as a
 * room would show a not-found screen for something the browser handles fine.
 */
const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "auth",
  "login",
  "logout",
  "recordings",
  "privacy",
  "terms",
  "favicon.ico",
]);

export interface CalVideoRoomLink {
  kind: "room";
  /** `https://i.cal.video` — where the room's API lives. */
  origin: string;
  /** What a person reads out: `i.cal.video`. */
  host: string;
  /** `i` for `i.cal.video`, `null` at the apex. */
  orgSlug: string | null;
  slug: string;
  /** From the `#i=<token>` fragment; never sent in a URL, only posted back on join. */
  inviteToken: string | null;
  /** The canonical web address, fragment included, so the link can be shared or reopened. */
  url: string;
}

export interface CalVideoBookingLink {
  kind: "booking";
  /** `https://app.cal.com` — where the booking's video page lives. */
  origin: string;
  /** What a person reads out: `app.cal.com`. */
  host: string;
  bookingUid: string;
  /** The canonical web address, which also serves as the fallback to open in a browser. */
  url: string;
}

export type CalVideoLink = CalVideoRoomLink | CalVideoBookingLink;

function apexFor(hostname: string): { apex: string; orgSlug: string | null } | null {
  for (const apex of CAL_VIDEO_APEX_HOSTS) {
    if (hostname === apex) return { apex, orgSlug: null };
    if (!hostname.endsWith(`.${apex}`)) continue;
    const label = hostname.slice(0, -(apex.length + 1));
    // Only a single label is an org; `www` is the marketing site.
    if (!label || label.includes(".") || label === "www") return null;
    return { apex, orgSlug: label };
  }
  return null;
}

export function isValidRoomSlug(slug: string): boolean {
  if (!slug || slug.length > MAX_SLUG_LENGTH) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  return !RESERVED_SLUGS.has(slug);
}

function parseBookingLink(url: URL): CalVideoBookingLink | null {
  const hostname = url.hostname.toLowerCase();
  if (!BOOKING_VIDEO_HOSTNAMES.has(hostname)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0].toLowerCase() !== "video") return null;
  const bookingUid = decodeURIComponent(segments[1]);
  // `/video/no-meeting-found` is a page; the other outcome pages carry a third segment.
  if (!BOOKING_UID_PATTERN.test(bookingUid) || bookingUid === "no-meeting-found") return null;
  const origin = `${url.protocol}//${url.host}`;
  return {
    kind: "booking",
    origin,
    host: url.host,
    bookingUid,
    url: `${origin}/video/${bookingUid}`,
  };
}

function parseWebLink(url: URL): CalVideoLink | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname.toLowerCase();
  const scope = apexFor(hostname);
  if (!scope) return parseBookingLink(url);

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const slug = decodeURIComponent(segments[0]).toLowerCase();
  if (!isValidRoomSlug(slug)) return null;

  const fragment = url.hash.replace(/^#/, "");
  const inviteToken = fragment.startsWith("i=") ? fragment.slice(2) || null : null;

  const origin = `${url.protocol}//${url.host}`;
  return {
    kind: "room",
    origin,
    host: url.host,
    orgSlug: scope.orgSlug,
    slug,
    inviteToken,
    url: `${origin}/${slug}${inviteToken ? `#i=${inviteToken}` : ""}`,
  };
}

function parseSchemeLink(url: URL): CalVideoLink | null {
  // `calcom://video?...` parses with host `video`; `calcom:///video` with an empty host.
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  const isVideo = host === "video" || (host === "" && segments[0] === "video");
  if (!isVideo) return null;
  if (host === "") segments.shift();

  const wrapped = url.searchParams.get("url");
  if (wrapped) return parseCalVideoLink(wrapped);

  // `calcom://video/<host>/<slug>`
  if (segments.length === 2) {
    return parseCalVideoLink(`https://${segments[0]}/${segments[1]}${url.hash}`);
  }
  return null;
}

/**
 * The room or booking meeting a URL names, or `null` for anything else — including a Cal Video
 * page that is neither, so callers can fall back to the browser without a second check.
 */
export function parseCalVideoLink(input: string | null | undefined): CalVideoLink | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol === "https:" || url.protocol === "http:") return parseWebLink(url);
  if (url.protocol === "calcom:") return parseSchemeLink(url);
  return null;
}

/** The in-app route that opens a room natively. The full URL rides along so nothing is re-derived. */
export function buildVideoCallHref(link: Pick<CalVideoLink, "url">): string {
  return `/video-call?url=${encodeURIComponent(link.url)}`;
}

/** `i.cal.video/peer` — the room as it is read aloud. */
export function roomAddress(link: Pick<CalVideoRoomLink, "host" | "slug">): string {
  return `${link.host}/${link.slug}`;
}

/** The link as it is read aloud: a room's address, or `app.cal.com/video/<uid>` for a booking. */
export function linkAddress(link: CalVideoLink): string {
  return link.kind === "room" ? roomAddress(link) : `${link.host}/video/${link.bookingUid}`;
}
