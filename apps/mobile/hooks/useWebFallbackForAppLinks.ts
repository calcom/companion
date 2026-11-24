import { useEffect, useRef } from "react";
import type { IncomingLink } from "@/hooks/useIncomingLink";
import { resolveAppLink } from "@/utils/app-link-navigation";
import { openInAppBrowser } from "@/utils/browser";
import { parseCalVideoLink } from "@/utils/cal-video-links";

/**
 * Opens a Cal.com web app link the app has no screen for (`app.cal.com/availability/troubleshoot`)
 * in the in-app browser, once per arrival. `+native-intent` leaves the router where it is for
 * these. The in-app browser shows the page itself rather than handing the link back to the system,
 * so it can't loop into the app.
 */
export function useWebFallbackForAppLinks(incoming: IncomingLink | null): void {
  const url = incoming?.url ?? null;
  const seq = incoming?.seq ?? null;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (url === null || seq === null) return;
    const arrival = `${seq}:${url}`;
    if (handled.current === arrival) return;
    handled.current = arrival;
    if (parseCalVideoLink(url)) return;
    const target = resolveAppLink(url);
    if (target?.kind === "web") void openInAppBrowser(target.url, "Cal.com page");
  }, [url, seq]);
}
