import { type CalVideoBookingLink, parseCalVideoLink } from "@/utils/cal-video-links";

/**
 * What a booking's `/video/<uid>` page says about the meeting right now.
 *
 * The page is the source of truth: it redirects to an outcome page when the meeting has not
 * started, is over, or does not exist, follows a reschedule chain to the current booking, and
 * otherwise serves the room. The app reads where it landed rather than re-deriving any of that.
 */
export type BookingLinkResolution =
  /** A Cal Video room the app joins natively. */
  | { kind: "room"; url: string }
  | { kind: "not-started" }
  | { kind: "ended" }
  | { kind: "not-found" }
  /** A meeting page the app cannot run itself (the legacy provider); open it in a browser. */
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

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; url: string }>;

/**
 * Ask the booking's video page what the uid means today. The request follows the page's
 * redirects, so the answer is in the final URL; a 404 with no redirect means no such booking.
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
  // A server error on the page itself is not an answer about the meeting.
  if (resolution.kind === "web" && !response.ok) {
    throw new Error(`Booking video page answered ${response.status}`);
  }
  return resolution;
}
