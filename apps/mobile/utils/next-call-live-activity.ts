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

export type NextCallPlan =
  | { action: "none" }
  /** Nothing to show yet; start the activity at `startAt`. */
  | { action: "wait"; startAt: Date; payload: NextCallLiveActivityPayload }
  /**
   * Show (or keep showing) the activity until `endsAt`. Re-plan at `replanAt`: the call's end,
   * or earlier when another call's lead window opens and it takes over.
   */
  | { action: "show"; endsAt: Date; replanAt: Date; payload: NextCallLiveActivityPayload };

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

interface ConfirmedCall {
  booking: Booking;
  start: number;
  end: number;
}

function getConfirmedCalls(bookings: readonly Booking[], now: Date): ConfirmedCall[] {
  const calls: ConfirmedCall[] = [];
  for (const booking of bookings) {
    if (booking.status && booking.status !== "accepted") continue;
    const start = getBookingStart(booking);
    const end = getBookingEnd(booking);
    if (!start || !end || end.getTime() <= now.getTime()) continue;
    calls.push({ booking, start: start.getTime(), end: end.getTime() });
  }
  return calls.sort((a, b) => a.start - b.start);
}

/**
 * The confirmed booking to show: a call starting within the lead window takes over from one
 * already in progress (so a long block or a back-to-back call does not hide it); otherwise the
 * one in progress, or else the soonest upcoming one.
 * Pending (unconfirmed), cancelled and rejected bookings never get a reminder.
 */
export function pickNextCall(bookings: readonly Booking[], now: Date): Booking | null {
  const calls = getConfirmedCalls(bookings, now);
  const nowMs = now.getTime();
  const startingSoon = calls.find(
    (call) => call.start > nowMs && call.start - NEXT_CALL_LEAD_TIME_MS <= nowMs
  );
  return startingSoon?.booking ?? calls[0]?.booking ?? null;
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
    return app === "daily" || app === "cal-video" ? "Cal Video" : app.replace(/[_-]/g, " ");
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
  // Free text is never treated as video: words like "meet" or "teams" also name rooms.
  const isVideo =
    meetingUrl !== null || (booking.location?.trim().startsWith("integrations:") ?? false);

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
  const endsAt = new Date(payload.endTime);
  let replanAt = endsAt.getTime();
  for (const call of getConfirmedCalls(bookings, now)) {
    const opensAt = call.start - NEXT_CALL_LEAD_TIME_MS;
    if (opensAt > now.getTime() && opensAt < replanAt) replanAt = opensAt;
  }
  return { action: "show", endsAt, replanAt: new Date(replanAt), payload };
}
