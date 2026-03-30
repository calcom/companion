/**
 * Cal Video Utilities
 *
 * Utilities for detecting Cal Video URLs and extracting the Daily.co room URL
 * needed to join a native video call via react-native-daily-js.
 *
 * Cal Video is powered by Daily.co. Cal Video URLs follow the pattern:
 *   https://app.cal.com/video/<room-id>
 *
 * The corresponding Daily.co room URL is:
 *   https://cal-video.daily.co/<room-id>
 */

const CAL_VIDEO_HOSTS = ["app.cal.com", "cal.com"];
const CAL_VIDEO_PATH_PREFIX = "/video/";
const DAILY_ROOM_BASE = "https://meetco.daily.co";

/**
 * Check if a URL is a Cal Video URL that can be opened natively.
 *
 * @param url - The meeting URL to check
 * @returns true if the URL is a Cal Video URL
 */
export function isCalVideoUrl(url: string): boolean {
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
 * Extract the Daily.co room URL from a Cal Video URL.
 *
 * Cal Video URLs map to Daily.co rooms:
 *   https://app.cal.com/video/<room-id> -> https://cal-video.daily.co/<room-id>
 *
 * @param calVideoUrl - A Cal Video URL (e.g. https://app.cal.com/video/abc123)
 * @returns The Daily.co room URL, or null if the URL is not a valid Cal Video URL
 */
export function getDailyRoomUrl(calVideoUrl: string): string | null {
  try {
    const parsed = new URL(calVideoUrl);
    if (
      !CAL_VIDEO_HOSTS.includes(parsed.hostname) ||
      !parsed.pathname.startsWith(CAL_VIDEO_PATH_PREFIX)
    ) {
      return null;
    }

    // Extract the room ID (everything after /video/)
    const roomId = parsed.pathname.slice(CAL_VIDEO_PATH_PREFIX.length);
    if (!roomId) return null;

    return `${DAILY_ROOM_BASE}/${roomId}`;
  } catch {
    return null;
  }
}
