/**
 * Cal Video room links.
 *
 * A room is addressed as `https://cal.video/<slug>` at the root, or `https://<org>.cal.video/<slug>`
 * inside an organization — `i.cal.video/peer` is the member `peer` of the org `i`, `i.cal.video/sales`
 * that org's `sales` team. The host decides the namespace, so it travels with the slug everywhere.
 *
 * The same shapes are accepted through the app's own scheme, for places that cannot open a
 * universal link (simulators, notification payloads, tests):
 *   `calcom://video?url=https%3A%2F%2Fi.cal.video%2Fpeer`
 *   `calcom://video/i.cal.video/peer`
 */

/** Apex hosts this app opens natively. Deliberately not `cal.com`: those are booking pages. */
const CAL_VIDEO_APEX_HOSTS: readonly string[] = ["cal.video"];

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

function parseWebLink(url: URL): CalVideoRoomLink | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname.toLowerCase();
  const scope = apexFor(hostname);
  if (!scope) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const slug = decodeURIComponent(segments[0]).toLowerCase();
  if (!isValidRoomSlug(slug)) return null;

  const fragment = url.hash.replace(/^#/, "");
  const inviteToken = fragment.startsWith("i=") ? fragment.slice(2) || null : null;

  const origin = `${url.protocol}//${url.host}`;
  return {
    origin,
    host: url.host,
    orgSlug: scope.orgSlug,
    slug,
    inviteToken,
    url: `${origin}/${slug}${inviteToken ? `#i=${inviteToken}` : ""}`,
  };
}

function parseSchemeLink(url: URL): CalVideoRoomLink | null {
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
 * The room a URL names, or `null` for anything else — including a Cal Video page that is not a
 * room, so callers can fall back to the browser without a second check.
 */
export function parseCalVideoLink(input: string | null | undefined): CalVideoRoomLink | null {
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
export function buildVideoCallHref(link: CalVideoRoomLink): string {
  return `/video-call?url=${encodeURIComponent(link.url)}`;
}

/** `i.cal.video/peer` — the room as it is read aloud. */
export function roomAddress(link: Pick<CalVideoRoomLink, "host" | "slug">): string {
  return `${link.host}/${link.slug}`;
}
