/**
 * Booking Utilities
 *
 * Shared utility functions for working with bookings.
 */

import type { Booking } from "@/services/calcom";
import { CAL_APP_HOSTNAMES } from "./region";

const CAL_VIDEO_HOSTNAMES: ReadonlySet<string> = new Set([
  ...CAL_APP_HOSTNAMES,
  "cal.com",
  "cal.eu",
  "cal.video",
]);

/**
 * Extract the meeting URL from a booking.
 *
 * Checks both the booking's responses.videoCallUrl and location fields
 * for a valid HTTP(S) URL that can be used to join the meeting.
 *
 * @param booking - The booking to extract the meeting URL from
 * @returns The meeting URL if found, null otherwise
 *
 * @example
 * ```tsx
 * const meetingUrl = getMeetingUrl(booking);
 * if (meetingUrl) {
 *   openInDefaultBrowser(meetingUrl, "meeting link");
 * }
 * ```
 */
export const getMeetingUrl = (booking: Booking | null): string | null => {
  if (!booking) return null;

  // Check metadata for videoCallUrl first
  const videoCallUrl = booking.responses?.videoCallUrl;
  if (typeof videoCallUrl === "string" && videoCallUrl.startsWith("http")) {
    return videoCallUrl;
  }

  // Check location
  const location = booking.location;
  if (typeof location === "string" && location.startsWith("http")) {
    return location;
  }

  return null;
};

/**
 * Returns true when the supplied meeting URL points to Cal Video, regardless of
 * whether it came from the US or EU cluster.
 */
export const isCalVideoMeetingUrl = (meetingUrl?: string | null): boolean => {
  if (!meetingUrl) return false;

  const normalized = meetingUrl.trim().toLowerCase();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    return false;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname === "cal.video") {
      return true;
    }

    const pathname = url.pathname.toLowerCase();
    return CAL_VIDEO_HOSTNAMES.has(url.hostname) && (pathname === "/video" || pathname.startsWith("/video/"));
  } catch {
    return normalized.includes("cal.video") || normalized.includes("cal-video");
  }
};
