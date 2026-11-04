/**
 * Next-call Live Activity planning (pure logic, no native calls).
 *
 * The iOS Live Activity shows the next booking from five minutes before it starts until it
 * ends. This module decides, for a list of bookings and a point in time, whether the activity
 * should be showing now, when it should next be started, and what it should display.
 */
import type { NextCallLiveActivityPayload } from "@/modules/next-call-live-activity/types";
import type { Booking } from "@/services/types/bookings.types";
import { getMeetingUrl, isCalVideoMeetingUrl } from "./booking";

/** How long before the call the Live Activity appears. */
export const NEXT_CALL_LEAD_TIME_MS = 5 * 60 * 1000;

const VIDEO_LOCATION_KEYWORDS = ["zoom", "meet", "teams", "webex", "cal video", "daily"];

export type NextCallPlan =
  | { action: "none" }
  /** Nothing to show yet; start the activity at `startAt`. */
  | { action: "wait"; startAt: Date; payload: NextCallLiveActivityPayload }
  /** Show (or keep showing) the activity until `endsAt`. */
  | { action: "show"; endsAt: Date; payload: NextCallLiveActivityPayload };

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getBookingStart(booking: Booking): Date | null {
  return parseDate(booking.startTime || booking.start);
}

export function getBookingEnd(booking: Booking): Date | null {
  return parseDate(booking.endTime || booking.end);
}

/**
 * The confirmed booking that ends next, i.e. the one in progress or the soonest upcoming one.
 * Pending (unconfirmed), cancelled and rejected bookings never get a reminder.
 */
export function pickNextCall(bookings: readonly Booking[], now: Date): Booking | null {
  let next: { booking: Booking; start: number } | null = null;
  for (const booking of bookings) {
    if (booking.status && booking.status !== "accepted") continue;
    const start = getBookingStart(booking);
    const end = getBookingEnd(booking);
    if (!start || !end || end.getTime() <= now.getTime()) continue;
    if (!next || start.getTime() < next.start) {
      next = { booking, start: start.getTime() };
    }
  }
  return next?.booking ?? null;
}

function getLocationLabel(booking: Booking, meetingUrl: string | null): string | null {
  if (isCalVideoMeetingUrl(meetingUrl)) return "Cal Video";
  if (meetingUrl) {
    try {
      return new URL(meetingUrl).hostname.replace(/^www\./, "");
    } catch {
      return meetingUrl;
    }
  }
  const location = booking.location?.trim();
  if (!location) return null;
  if (location.startsWith("integrations:")) {
    const app = location.slice("integrations:".length);
    return app === "daily" ? "Cal Video" : app.replace(/[_-]/g, " ");
  }
  return location;
}

export function getNextCallDeepLink(uid: string): string {
  return `calcom://(tabs)/(bookings)/booking-detail?uid=${encodeURIComponent(uid)}`;
}

export function buildNextCallPayload(booking: Booking): NextCallLiveActivityPayload | null {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  if (!start || !end) return null;

  const uid = booking.uid || String(booking.id);
  const attendees = booking.attendees ?? [];
  const meetingUrl = getMeetingUrl(booking);
  const locationLower = (booking.location ?? "").toLowerCase();
  const isVideo =
    meetingUrl !== null || VIDEO_LOCATION_KEYWORDS.some((word) => locationLower.includes(word));

  return {
    uid,
    title: booking.title,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    attendeeName: attendees[0]?.name?.trim() || null,
    attendeeCount: attendees.length,
    locationLabel: getLocationLabel(booking, meetingUrl),
    isVideo,
    deepLinkUrl: getNextCallDeepLink(uid),
  };
}

export function planNextCallLiveActivity(
  bookings: readonly Booking[],
  now: Date = new Date()
): NextCallPlan {
  const booking = pickNextCall(bookings, now);
  if (!booking) return { action: "none" };
  const payload = buildNextCallPayload(booking);
  if (!payload) return { action: "none" };

  const showAt = new Date(new Date(payload.startTime).getTime() - NEXT_CALL_LEAD_TIME_MS);
  if (showAt.getTime() > now.getTime()) {
    return { action: "wait", startAt: showAt, payload };
  }
  return { action: "show", endsAt: new Date(payload.endTime), payload };
}
