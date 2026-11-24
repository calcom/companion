import { CAL_APP_HOSTNAMES } from "./region";

/** Where a Cal.com web app link opens: one of the app's screens, or the web for a page it doesn't have. */
export type AppLinkTarget = { kind: "screen"; href: string } | { kind: "web"; url: string };

/** Marks a screen opened from a link, so the tabs don't swap it for the user's landing page. */
export const APP_LINK_SOURCE = "app-link";

const BOOKING_FILTERS: ReadonlySet<string> = new Set([
  "upcoming",
  "unconfirmed",
  "recurring",
  "past",
  "cancelled",
]);

function screen(pathname: string, params: Record<string, string> = {}): AppLinkTarget {
  const query = new URLSearchParams({ ...params, source: APP_LINK_SOURCE });
  return { kind: "screen", href: `${pathname}?${query.toString()}` };
}

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

function screenFor(url: URL): AppLinkTarget | null {
  const [section, detail, ...rest] = url.pathname.split("/").filter(Boolean);
  if (rest.length > 0) return null;

  switch (section) {
    case "bookings": {
      if (detail !== undefined && !BOOKING_FILTERS.has(detail)) return null;
      // The web keeps the booking open in its details sheet as `?uid=`.
      const uid = url.searchParams.get("uid");
      if (uid) return screen("/(tabs)/(bookings)/booking-detail", { uid });
      return screen("/(tabs)/(bookings)", detail ? { filter: detail } : {});
    }
    case "event-types":
      if (detail === undefined) return screen("/(tabs)/(event-types)");
      return isNumericId(detail)
        ? screen("/(tabs)/(event-types)/event-type-detail", { id: detail })
        : null;
    case "availability":
      if (detail === undefined) return screen("/(tabs)/(availability)");
      return isNumericId(detail)
        ? screen("/(tabs)/(availability)/availability-detail", { id: detail })
        : null;
    case "more":
      return detail === undefined ? screen("/(tabs)/(more)") : null;
    default:
      return null;
  }
}

/**
 * Where a link to the Cal.com web app (`app.cal.com/bookings`, an event type, a schedule) opens.
 * A page the app has no screen for goes to the web, so a link never lands on "not found".
 * Null for anything that isn't a Cal.com web app link.
 */
export function resolveAppLink(input: string): AppLinkTarget | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CAL_APP_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return null;
  }
  return screenFor(url) ?? { kind: "web", url: url.href };
}
