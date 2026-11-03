import { buildVideoCallHref, parseCalVideoLink } from "@/utils/cal-video-links";

/**
 * Rewrites incoming system URLs before the router matches them.
 *
 * A universal link such as `https://i.cal.video/peer` has no route of its own — the path is the
 * room slug — so it is folded into the video-call screen with the room URL as a parameter.
 * Everything else passes through untouched.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const link = parseCalVideoLink(path);
    return link ? buildVideoCallHref(link) : null;
  } catch {
    return null;
  }
}
