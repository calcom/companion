import { CAL_APP_HOSTNAMES } from "@/utils/region";

const BOOKING_FILTERS = new Set(["upcoming", "unconfirmed", "recurring", "past", "cancelled"]);
const APP_LINK_SOURCE = "app-link";

function routeWithParams(pathname: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams({ ...params, source: APP_LINK_SOURCE });
  return `${pathname}?${searchParams.toString()}`;
}

function isNumericId(value: string | undefined): value is string {
  return value !== undefined && /^\d+$/.test(value);
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function getNativeRouteFromAppLink(path: string): string {
  let url: URL;

  try {
    url = new URL(path);
  } catch {
    return path;
  }

  if (url.protocol !== "https:" || !CAL_APP_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return path;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const [section, detail, extra] = segments;

  if (section === "bookings" && extra === undefined) {
    const isBookingsIndex = detail === undefined;
    const isBookingFilter = detail !== undefined && BOOKING_FILTERS.has(detail);

    if (!isBookingsIndex && !isBookingFilter) {
      return path;
    }

    const uid = url.searchParams.get("uid");
    if (uid) {
      return routeWithParams("/(tabs)/(bookings)/booking-detail", { uid });
    }

    return routeWithParams("/(tabs)/(bookings)", detail ? { filter: detail } : {});
  }

  if (section === "booking" && detail && extra === undefined) {
    const uid = decodePathSegment(detail);
    if (!uid) {
      return path;
    }

    return routeWithParams("/(tabs)/(bookings)/booking-detail", {
      uid,
    });
  }

  if (section === "event-types" && extra === undefined) {
    if (detail === undefined) {
      return routeWithParams("/(tabs)/(event-types)");
    }

    if (isNumericId(detail)) {
      return routeWithParams("/(tabs)/(event-types)/event-type-detail", { id: detail });
    }

    return path;
  }

  if (section === "availability" && extra === undefined) {
    if (detail === undefined) {
      return routeWithParams("/(tabs)/(availability)");
    }

    if (isNumericId(detail)) {
      return routeWithParams("/(tabs)/(availability)/availability-detail", { id: detail });
    }

    return path;
  }

  if (section === "more" && detail === undefined) {
    return routeWithParams("/(tabs)/(more)");
  }

  return path;
}
