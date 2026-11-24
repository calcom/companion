import { type CalVideoBookingLink, parseCalVideoLink } from "@/utils/cal-video-links";

/**
 * A Cal Video 2.0 booking call. Its page on the web app runs the call in an embedded cal.video
 * frame instead of redirecting to a room, so the app joins it the way that frame does: admission
 * on the web app, then the session join on the video origin.
 */
export interface CalVideoBookingCall {
  kind: "booking-call";
  /** `https://app.cal.com`: where the booking's admission lives. */
  appOrigin: string;
  /** What a person reads out: `app.cal.com`. */
  host: string;
  /** The booking the page is for, after any reschedule it followed. */
  bookingUid: string;
  /** The booking's call page, which is also the fallback to open in a browser. */
  url: string;
  /** `https://cal.video`: where the call's session lives. */
  videoOrigin: string;
  /** The event type asks guests for an email before they join. */
  requireEmail: boolean;
}

/**
 * What a booking's `/video/<uid>` page says about the meeting right now.
 *
 * The page is the source of truth: it redirects to an outcome page when the meeting has not
 * started, is over, or does not exist, follows a reschedule chain to the current booking, and
 * otherwise serves the call. The app reads where it landed rather than re-deriving any of that.
 */
export type BookingLinkResolution =
  /** A Cal Video room the app joins natively. */
  | { kind: "room"; url: string }
  /** A Cal Video 2.0 booking call the app joins natively. */
  | { kind: "booking-call"; call: CalVideoBookingCall }
  | { kind: "not-started" }
  | { kind: "ended" }
  | { kind: "not-found" }
  /** A meeting page the app cannot run itself (Cal Video 1, on Daily); open it in a browser. */
  | { kind: "web"; url: string };

/** Where a booking's video page sent us, read from the URL the request finally landed on. */
export function classifyLandingUrl(
  landed: string,
  link: CalVideoBookingLink
): BookingLinkResolution {
  const room = parseCalVideoLink(landed);
  if (room?.kind === "room") return { kind: "room", url: room.url };

  let url: URL;
  try {
    url = new URL(landed);
  } catch {
    return { kind: "web", url: link.url };
  }
  const path = url.pathname.toLowerCase();
  if (path.startsWith("/video/meeting-not-started/")) return { kind: "not-started" };
  if (path.startsWith("/video/meeting-ended/")) return { kind: "ended" };
  if (path.startsWith("/video/no-meeting-found")) return { kind: "not-found" };
  return { kind: "web", url: url.href };
}

/** The page's call frame: `<iframe … src="https://cal.video/embed/booking/<uid>">`. */
const EMBED_FRAME =
  /<iframe\b[^>]*\bsrc="(https:\/\/[a-z0-9.-]+)\/embed\/booking\/([A-Za-z0-9_-]{1,64})"/i;
const REQUIRE_EMAIL = /\\?"requireEmailForGuests\\?":\s*(true|false)/;

/** Only Cal Video's own hosts receive the admission token. */
function isCalVideoOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname.toLowerCase();
  return hostname === "cal.video" || hostname.endsWith(".cal.video");
}

/**
 * Reads a booking page the app landed on. A Cal Video 2.0 call embeds cal.video's booking frame;
 * Cal Video 1 doesn't, and gets `null`. `landed` must already be a booking link: the page's own
 * host is where admission is sent, with the signed-in user's token.
 */
export function readBookingCallPage(
  html: string,
  landed: CalVideoBookingLink
): CalVideoBookingCall | null {
  const frame = EMBED_FRAME.exec(html);
  if (!frame) return null;
  const [, videoOrigin, bookingUid] = frame;
  if (!isCalVideoOrigin(videoOrigin)) return null;
  return {
    kind: "booking-call",
    appOrigin: landed.origin,
    host: landed.host,
    bookingUid,
    url: `${landed.origin}/video/${bookingUid}`,
    videoOrigin,
    requireEmail: REQUIRE_EMAIL.exec(html)?.[1] === "true",
  };
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; url: string; text?: () => Promise<string> }>;

/**
 * Ask the booking's video page what the uid means today. The request follows the page's
 * redirects, so the answer is in the final URL; a 404 with no redirect means no such booking.
 * Loading the page is also what opens a 2.0 booking's room, so it comes before admission.
 * Network failures propagate, so the caller can offer a retry.
 */
export async function resolveBookingLink(
  link: CalVideoBookingLink,
  fetchImpl: FetchLike = fetch
): Promise<BookingLinkResolution> {
  const response = await fetchImpl(link.url, {
    method: "GET",
    headers: { Accept: "text/html" },
  });
  if (response.status === 404) return { kind: "not-found" };
  const landed = response.url || link.url;
  const resolution = classifyLandingUrl(landed, link);
  if (resolution.kind !== "web") return resolution;
  // A server error on the page itself is not an answer about the meeting.
  if (!response.ok) throw new Error(`Booking video page answered ${response.status}`);

  // Still on a booking page: a 2.0 call the app can join, or a Cal Video 1 page for the browser.
  const landedLink = parseCalVideoLink(landed);
  if (landedLink?.kind === "booking" && response.text) {
    const call = readBookingCallPage(await response.text(), landedLink);
    if (call) return { kind: "booking-call", call };
  }
  return resolution;
}
