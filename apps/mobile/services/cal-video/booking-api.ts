/**
 * Getting into a Cal Video 2.0 booking call, the two steps the web page's embedded frame takes.
 *
 * 1. Admission, on the web app (`POST <app>/api/video/booking-admission/<uid>`): decides host or
 *    guest from the booking and returns an embed token for this person. A guest's `cvbg` cookie
 *    (path-scoped to that route) keeps the same participant across retries.
 * 2. Session join, on the video origin (`POST <video>/api/sessions/<sessionId>/join` with the
 *    embed token as `Bearer`): returns the same grant a standalone room join does, plus the slug
 *    of the booking's room for the control-token routes (leave, recording, captions).
 *
 * The embed token also authorises Cal chat for the session, so it is handed back to the caller.
 */
import { fetchWithTimeout } from "@/utils/network";
import type { CalVideoBookingCall } from "./booking-link";
import { joinGrantSchema } from "./join-grant-schema";
import type { JoinFailure } from "./room-screen";
import type { JoinGrant } from "./types";

const TIMEOUT_MS = 20_000;

export type BookingAdmission =
  | { kind: "admitted"; token: string; sessionId: string; redirectUrl: string | null }
  /** The event type asks guests for an email; ask for one and admit again. */
  | { kind: "email-required" }
  | { kind: "failure"; failure: JoinFailure };

export type BookingSessionJoin =
  | { kind: "admitted"; grant: JoinGrant; roomSlug: string }
  | { kind: "failure"; failure: JoinFailure };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** What an admission refusal means for the app. Outcomes the app cannot resolve go to the web. */
export function admissionFailure(status: number, outcome: unknown): BookingAdmission {
  if (status === 429 || outcome === "rate-limited")
    return { kind: "failure", failure: "rate-limited" };
  if (outcome === "email-required") return { kind: "email-required" };
  if (outcome === "meeting-full") return { kind: "failure", failure: "full" };
  if (status === 404 || status === 410 || outcome === "not-found" || outcome === "meeting-ended") {
    return { kind: "failure", failure: "not-found" };
  }
  // `host-must-sign-in`, `email-not-attendee`, `meeting-too-long`, `meeting-unavailable`: the web
  // page explains each one and can sign the host in.
  if (status === 403 || status === 409 || status === 503) {
    return { kind: "failure", failure: "needs-web" };
  }
  return { kind: "failure", failure: "error" };
}

export async function admitToBooking(input: {
  call: CalVideoBookingCall;
  displayName: string;
  email?: string | null;
  /** The signed-in user's Cal.com access token, so the booking's host joins as host. */
  accessToken?: string | null;
}): Promise<BookingAdmission> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (input.accessToken) headers.Authorization = `Bearer ${input.accessToken}`;
  const email = input.email?.trim();
  const response = await fetchWithTimeout(
    `${input.call.appOrigin}/api/video/booking-admission/${encodeURIComponent(input.call.bookingUid)}`,
    {
      method: "POST",
      credentials: "include",
      headers,
      // The body schema is strict: an empty email fails it, so it is left out instead.
      body: JSON.stringify(
        email ? { displayName: input.displayName, email } : { displayName: input.displayName }
      ),
    },
    TIMEOUT_MS
  );
  const body = await readJson(response);
  if (!response.ok) return admissionFailure(response.status, body.outcome);
  if (
    typeof body.token !== "string" ||
    !body.token ||
    typeof body.sessionId !== "string" ||
    !body.sessionId
  ) {
    return { kind: "failure", failure: "error" };
  }
  return {
    kind: "admitted",
    token: body.token,
    sessionId: body.sessionId,
    redirectUrl: typeof body.redirectUrl === "string" ? body.redirectUrl : null,
  };
}

/** What a session join refusal means for the app. */
export function sessionJoinFailure(status: number, body: Record<string, unknown>): JoinFailure {
  if (status === 429) return "rate-limited";
  if (status === 404 || body.outcome === "not-found") return "not-found";
  if (body.outcome === "full") return "full";
  // The speech consent tick (`speech_consent_required`, `_stale`, `_unsaved`) is only on the web.
  if (typeof body.reason === "string" && body.reason.startsWith("speech_consent"))
    return "needs-web";
  return "error";
}

export async function joinBookingSession(input: {
  call: CalVideoBookingCall;
  sessionId: string;
  token: string;
}): Promise<BookingSessionJoin> {
  const response = await fetchWithTimeout(
    `${input.call.videoOrigin}/api/sessions/${encodeURIComponent(input.sessionId)}/join`,
    {
      method: "POST",
      // The embed token is the whole identity here; a room's `cvi` cookie must not mix in.
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
      },
      body: "{}",
    },
    TIMEOUT_MS
  );
  const body = await readJson(response);
  if (!response.ok) return { kind: "failure", failure: sessionJoinFailure(response.status, body) };
  const parsed = joinGrantSchema.safeParse(body.grant);
  if (!parsed.success || typeof body.roomSlug !== "string" || !body.roomSlug) {
    return { kind: "failure", failure: "error" };
  }
  return { kind: "admitted", grant: parsed.data, roomSlug: body.roomSlug };
}
