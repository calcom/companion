import { resolveAppLink } from "@/utils/app-link-navigation";
import { buildVideoCallHref, parseCalVideoLink } from "@/utils/cal-video-links";

/**
 * Rewrites incoming system URLs before the router matches them.
 *
 * A universal link such as `https://i.cal.video/peer` has no route of its own — the path is the
 * room slug — so it is folded into the video-call screen with the room URL as a parameter. A Cal.com
 * web app link (`https://app.cal.com/bookings`) opens the matching screen. A web app page the app
 * has no screen for returns null, so the router stays where it is; `useWebFallbackForAppLinks`
 * opens it in the in-app browser. Everything else passes through untouched.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const link = parseCalVideoLink(path);
    if (link) return buildVideoCallHref(link);
    const target = resolveAppLink(path);
    if (!target) return path;
    return target.kind === "screen" ? target.href : null;
  } catch {
    return path;
  }
}
