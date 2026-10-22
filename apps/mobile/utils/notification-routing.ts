/**
 * Routes push-notification taps into the app.
 *
 * Cal.com push payloads carry `data.url` (a `calcom://` deep link), an optional
 * `data.bookingUid`, and `data.notificationEvent` (see `NOTIFICATION_EVENTS` in
 * constants/notifications.ts, mirroring the `NotificationEvent` enum in
 * calcom/cal). Resolution order: a concrete booking wins, then an allowlisted
 * tab-group link, then any known event lands on the bookings list, else the tap
 * is dropped.
 */
import * as Linking from "expo-linking";

import { NOTIFICATION_EVENTS, type NotificationEvent } from "@/constants/notifications";

export type NotificationData = Record<string, unknown> | undefined;

const NOTIFICATION_URL_SCHEME = "calcom";

/**
 * Tab groups under `app/(tabs)/` that a `calcom://(tabs)/<group>` link may
 * route to. Extend here when a new tab group ships — `(events)` is excluded
 * until calcom/companion#183 lands it.
 */
const NOTIFICATION_ROUTE_GROUPS = [
  "(bookings)",
  "(event-types)",
  "(availability)",
  "(more)",
] as const;

const BOOKINGS_LIST_ROUTE = "/(tabs)/(bookings)";

export function parseNotificationEvent(value: unknown): NotificationEvent | null {
  if (typeof value !== "string") return null;
  return (NOTIFICATION_EVENTS as readonly string[]).includes(value)
    ? (value as NotificationEvent)
    : null;
}

function bookingDetailRoute(uid: string): string {
  return `/(tabs)/(bookings)/booking-detail?uid=${encodeURIComponent(uid)}&source=notification`;
}

function parseNotificationUrl(url: string): Linking.ParsedURL | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.scheme !== NOTIFICATION_URL_SCHEME) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeQueryParams(queryParams: Linking.QueryParams | null | undefined): string {
  if (!queryParams) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value == null) continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function resolveNotificationRoute(data: NotificationData): string | null {
  if (!data) return null;

  const url = typeof data.url === "string" ? data.url : null;
  const parsed = url ? parseNotificationUrl(url) : null;

  const bookingUid =
    typeof data.bookingUid === "string" && data.bookingUid.length > 0
      ? data.bookingUid
      : typeof parsed?.queryParams?.uid === "string" && parsed.queryParams.uid.length > 0
        ? parsed.queryParams.uid
        : null;
  if (bookingUid) return bookingDetailRoute(bookingUid);

  if (parsed?.hostname === "(tabs)" && parsed.path) {
    const [group, ...rest] = parsed.path.split("/");
    if ((NOTIFICATION_ROUTE_GROUPS as readonly string[]).includes(group)) {
      const suffix = rest.length > 0 ? `/${rest.join("/")}` : "";
      return `/${parsed.hostname}/${group}${suffix}${encodeQueryParams(parsed.queryParams)}`;
    }
  }

  if (parseNotificationEvent(data.notificationEvent)) return BOOKINGS_LIST_ROUTE;

  return null;
}
