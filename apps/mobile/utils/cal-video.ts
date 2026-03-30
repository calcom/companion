/**
 * Cal Video Utilities
 *
 * Utilities for detecting Cal Video / Daily.co URLs and resolving them
 * to joinable Daily.co room URLs for react-native-daily-js.
 *
 * There are two kinds of URLs this module handles:
 *
 * 1. **Daily.co room URLs** (returned by the Cal.com API in `meetingUrl` / `location`):
 *      https://meetco.daily.co/<room-name>
 *    These are already directly joinable — no further resolution needed.
 *
 * 2. **Cal Video web URLs** (used in deep links / browser):
 *      https://app.cal.com/video/<booking-uid>
 *    The path segment is a *booking UID*, not a Daily room name.
 *    To join the call we must fetch the booking via the API and read the
 *    Daily.co room URL from the booking's meetingUrl / location field.
 */

import { getBookingByUid } from "@/services/calcom/bookings";

const DAILY_HOST = "meetco.daily.co";
const CAL_VIDEO_HOSTS = ["app.cal.com", "cal.com"];
const CAL_VIDEO_PATH_PREFIX = "/video/";

/**
 * Check if a URL points directly to a Daily.co room (meetco.daily.co).
 *
 * These URLs are returned by the Cal.com API and can be passed straight
 * to `callObject.join({ url })`.
 */
export function isDailyRoomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === DAILY_HOST;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a Cal Video web URL (app.cal.com/video/*).
 *
 * These URLs contain a booking UID and require an API call to resolve
 * the actual Daily.co room URL.
 */
export function isCalVideoWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      CAL_VIDEO_HOSTS.includes(parsed.hostname) &&
      parsed.pathname.startsWith(CAL_VIDEO_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL can be handled as a native video call.
 *
 * Returns true for both direct Daily.co room URLs and Cal Video web URLs.
 */
export function isNativeVideoUrl(url: string): boolean {
  return isDailyRoomUrl(url) || isCalVideoWebUrl(url);
}

/**
 * Extract the booking UID from a Cal Video web URL.
 *
 * @param url - e.g. https://app.cal.com/video/vgEm18Vh3wUGTVGWkgcUZj
 * @returns The booking UID, or null if the URL is not a Cal Video web URL
 */
export function getBookingUidFromCalVideoUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      !CAL_VIDEO_HOSTS.includes(parsed.hostname) ||
      !parsed.pathname.startsWith(CAL_VIDEO_PATH_PREFIX)
    ) {
      return null;
    }
    const uid = parsed.pathname.slice(CAL_VIDEO_PATH_PREFIX.length);
    return uid || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a meeting URL to a Daily.co room URL that can be joined natively.
 *
 * - If the URL is already a Daily.co room URL, returns it directly.
 * - If the URL is a Cal Video web URL (app.cal.com/video/<uid>), fetches the
 *   booking by UID and extracts the Daily.co room URL from the booking data.
 *
 * @param url - A Daily.co room URL or Cal Video web URL
 * @returns The Daily.co room URL, or null if resolution fails
 */
export async function resolveDailyRoomUrl(url: string): Promise<string | null> {
  // Already a direct Daily.co URL — use as-is
  if (isDailyRoomUrl(url)) {
    return url;
  }

  // Cal Video web URL — extract booking UID and fetch the booking
  const bookingUid = getBookingUidFromCalVideoUrl(url);
  if (!bookingUid) return null;

  try {
    const booking = await getBookingByUid(bookingUid);

    // The API returns the Daily.co room URL in meetingUrl or location
    if (booking.meetingUrl && isDailyRoomUrl(booking.meetingUrl)) {
      return booking.meetingUrl;
    }
    if (booking.location && isDailyRoomUrl(booking.location)) {
      return booking.location;
    }

    return null;
  } catch {
    return null;
  }
}
