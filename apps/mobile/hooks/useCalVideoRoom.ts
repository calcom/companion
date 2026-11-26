import { useCallback, useEffect, useRef, useState } from "react";
import {
  endMeeting,
  fetchRoomSpeechConsent,
  type JoinResult,
  joinRoom,
  knockRoom,
  knockStatus,
  leaveRoom,
  type RoomRef,
} from "@/services/cal-video/api";
import {
  admitToBooking,
  fetchBookingSpeechConsent,
  type GuestSpeechConsent,
  joinBookingSession,
  type SpeechConsentRefusal,
} from "@/services/cal-video/booking-api";
import type { BookingSpeechConsent, CalVideoBookingCall } from "@/services/cal-video/booking-link";
import type {
  JoinFailure,
  KnockState,
  RoomFailure,
  SessionEnd,
} from "@/services/cal-video/room-screen";
import type { JoinGrant } from "@/services/cal-video/types";
import type { CalVideoRoomLink } from "@/utils/cal-video-links";
import { safeLogWarn } from "@/utils/safeLogger";

/** The knocker is looking straight at the screen, so this is the one poll worth running hot. */
const KNOCK_POLL_MS = 2_000;

/** A standalone room, or a Cal Video 2.0 booking call. */
export type CalVideoCallTarget = CalVideoRoomLink | CalVideoBookingCall;

/** A booking call's room is only known once its session join answers. */
function initialRoom(link: CalVideoCallTarget): RoomRef | null {
  return link.kind === "room" ? { origin: link.origin, slug: link.slug } : null;
}

/**
 * Getting into a room, waiting at its door, and getting out again — the app-side port of the web
 * app's `useRoomSession` + `useKnock`. Everything about how the call *looks* lives elsewhere.
 *
 * A booking call never knocks: admission on the web app decides host or guest, and the session
 * join hands back the same grant a room join does, plus the room for the control-token routes.
 */
export function useCalVideoRoom({
  link,
  getAccessToken,
  beforeGrant,
}: {
  link: CalVideoCallTarget;
  /** Resolves when the join needs it, so a token that expired while the screen sat open is renewed. */
  getAccessToken: () => Promise<string | null>;
  /** Runs just before a grant is stored, to release anything the driver is about to need. */
  beforeGrant?: () => void;
}) {
  const [room, setRoom] = useState<RoomRef | null>(() => initialRoom(link));
  const [grant, setGrant] = useState<JoinGrant | null>(null);
  const [failure, setFailure] = useState<RoomFailure | null>(null);
  const [joining, setJoining] = useState(false);
  const [sessionEnd, setSessionEnd] = useState<SessionEnd | null>(null);
  const [knock, setKnock] = useState<KnockState>({ status: "idle" });
  /** A booking call's embed token: Cal chat for the session is authorised by it. */
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  /** The booking asks guests for an email, either up front or after an admission said so. */
  const [emailRequired, setEmailRequired] = useState(
    link.kind === "booking-call" && link.requireEmail
  );
  /**
   * The speech-processing checkbox this person must tick. For a booking call: from the
   * speech-consent route before a signed-in person joins, or once the session join asked for it;
   * a signed-out guest's is the page's, which the screen shows itself. For a room: read from the
   * room's page once the join asked for it.
   */
  const [speechConsentPrompt, setSpeechConsentPrompt] = useState<BookingSpeechConsent | null>(null);
  /** Why the last tick was refused, shown under Join as the web does; cleared by the next join. */
  const [speechConsentRefusal, setSpeechConsentRefusal] = useState<SpeechConsentRefusal | null>(
    null
  );
  const knockedAs = useRef<string | null>(null);
  const joinedAs = useRef<{
    name: string;
    email: string | null;
    speechConsent: GuestSpeechConsent | null;
  } | null>(null);
  const actedOn = useRef<string | null>(null);
  const beforeGrantRef = useRef(beforeGrant);
  const linkRef = useRef(link);
  const roomRef = useRef(room);
  const getAccessTokenRef = useRef(getAccessToken);
  useEffect(() => {
    beforeGrantRef.current = beforeGrant;
    linkRef.current = link;
    roomRef.current = room;
    getAccessTokenRef.current = getAccessToken;
  }, [beforeGrant, link, room, getAccessToken]);

  // Signed in, ask up front whether this person must tick, as the web page knows from its session.
  // No answer leaves the checkbox to the session join, which asks after the first Join.
  useEffect(() => {
    if (link.kind !== "booking-call") return;
    let cancelled = false;
    void (async () => {
      const accessToken = await getAccessTokenRef.current().catch(() => null);
      if (!accessToken || cancelled) return;
      const prompt = await fetchBookingSpeechConsent({ call: link, accessToken }).catch(() => null);
      if (prompt && !cancelled) setSpeechConsentPrompt(prompt);
    })();
    return () => {
      cancelled = true;
    };
  }, [link]);

  const resetKnock = useCallback(() => {
    setKnock({ status: "idle" });
  }, []);

  const startKnock = useCallback(async (displayName: string) => {
    const current = roomRef.current;
    if (!current) return setKnock({ status: "error" });
    try {
      const result = await knockRoom(current, displayName);
      switch (result.outcome) {
        case "waiting":
          setKnock({ status: "waiting", until: Date.now() + result.expiresInSeconds * 1000 });
          return;
        case "admitted":
          return setKnock({ status: "admitted" });
        case "open":
          return setKnock({ status: "open" });
        case "unavailable":
          return setKnock({ status: "unavailable" });
        case "lobby-full":
          return setKnock({ status: "lobby-full" });
        case "rate-limited":
          return setKnock({ status: "rate-limited" });
        default:
          return setKnock({ status: "error" });
      }
    } catch {
      setKnock({ status: "error" });
    }
  }, []);

  // Poll while waiting at the door.
  useEffect(() => {
    if (knock.status !== "waiting") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const until = knock.until;

    const poll = async () => {
      const current = roomRef.current;
      const status = current ? await knockStatus(current).catch(() => null) : null;
      if (cancelled) return;
      if (status === null) {
        // Network hiccup: keep polling until the knock itself expires.
        if (Date.now() >= until) return setKnock({ status: "unanswered" });
      } else {
        if (status.state === "gone") return setKnock({ status: "unanswered" });
        if (status.state === "admitted") return setKnock({ status: "admitted" });
        if (status.state === "denied") return setKnock({ status: "denied" });
        if (status.state === "open") return setKnock({ status: "open" });
        if (status.state === "expired" || status.state === "invalid" || Date.now() >= until) {
          return setKnock({ status: "unanswered" });
        }
      }
      timer = setTimeout(poll, KNOCK_POLL_MS);
    };

    timer = setTimeout(poll, KNOCK_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [knock]);

  const admit = useCallback(
    (grantIn: JoinGrant, booking: { room: RoomRef; embedToken: string } | null) => {
      safeLogWarn("[CalVideo] admitted", {
        transport: grantIn.transport,
        provider: grantIn.transport === "sfu" ? grantIn.provider : "loopback",
        role: grantIn.role,
        chat: grantIn.chat ?? "unset",
        booking: booking !== null,
      });
      beforeGrantRef.current?.();
      if (booking) {
        roomRef.current = booking.room;
        setRoom(booking.room);
        setEmbedToken(booking.embedToken);
      }
      setGrant(grantIn);
      setKnock({ status: "idle" });
    },
    []
  );

  const join = useCallback(
    async (
      name: string,
      email: string | null = null,
      speechConsent: GuestSpeechConsent | null = null
    ) => {
      setJoining(true);
      setFailure(null);
      setSpeechConsentRefusal(null);
      joinedAs.current = { name, email, speechConsent };
      const accessToken = await getAccessTokenRef.current().catch(() => null);
      const target = linkRef.current;

      if (target.kind === "booking-call") {
        const result = await joinBookingCall(target, {
          name,
          email,
          accessToken,
          speechConsent,
        }).catch(() => null);
        if (result === null) setFailure("error");
        else if (result.kind === "email-required") setEmailRequired(true);
        else if (result.kind === "consent-required") setSpeechConsentPrompt(target.speechConsent);
        else if (result.kind === "consent-refused") setSpeechConsentRefusal(result.refusal);
        else if (result.kind === "failure") setFailure(result.failure);
        else admit(result.grant, { room: result.room, embedToken: result.embedToken });
        setJoining(false);
        return;
      }

      const current = roomRef.current;
      const result: JoinResult | null = current
        ? await joinRoom({
            ...current,
            displayName: name,
            inviteToken: target.inviteToken,
            accessToken,
            speechConsent,
          }).catch(() => null)
        : null;
      if (result === null || current === null) {
        setFailure("error");
      } else if (result.kind === "consent-required") {
        // If the app can't read the checkbox, reopening reads the same page, so the call goes
        // to the web pre-join, which has it.
        const prompt = await fetchRoomSpeechConsent(current).catch(() => null);
        if (prompt) setSpeechConsentPrompt(prompt);
        else setFailure("needs-web");
      } else if (result.kind === "consent-refused") {
        setSpeechConsentRefusal(result.refusal);
      } else if (result.kind === "knock") {
        knockedAs.current = name;
        await startKnock(name);
      } else if (result.kind === "failure") {
        setFailure(result.failure);
      } else {
        admit(result.grant, null);
      }
      setJoining(false);
    },
    [startKnock, admit]
  );

  // Act on a host's answer at once rather than asking the person to press Join again.
  useEffect(() => {
    const name = knockedAs.current;
    if (!name) return;
    if (knock.status !== "open" && knock.status !== "admitted") return;
    if (actedOn.current === knock.status) return;
    actedOn.current = knock.status;
    void join(name, null, joinedAs.current?.speechConsent ?? null);
  }, [knock, join]);

  const retryKnock = useCallback(() => {
    actedOn.current = null;
    if (knockedAs.current) {
      void join(knockedAs.current, null, joinedAs.current?.speechConsent ?? null);
    }
  }, [join]);

  const leave = useCallback(() => {
    const current = grant;
    setSessionEnd((existing) => existing ?? "left");
    resetKnock();
    setGrant(null);
    if (current && roomRef.current) void leaveRoom(roomRef.current, current.controlToken);
  }, [grant, resetKnock]);

  const end = useCallback(async () => {
    if (!grant || !roomRef.current) throw new Error("No grant to end this meeting with");
    await endMeeting(roomRef.current, grant.controlToken);
    setSessionEnd("ended");
    setGrant(null);
  }, [grant]);

  /** Back to the pre-join form. */
  const rejoin = useCallback(() => {
    actedOn.current = null;
    resetKnock();
    setGrant(null);
    setSessionEnd(null);
    setFailure(null);
  }, [resetKnock]);

  /** Straight through the join route under the same name; for someone removed, this knocks. */
  const joinAgain = useCallback(
    async (ending: SessionEnd) => {
      const previous = joinedAs.current;
      if (!previous) return;
      setSessionEnd(ending);
      actedOn.current = null;
      resetKnock();
      setGrant(null);
      await join(previous.name, previous.email, previous.speechConsent);
      setSessionEnd(null);
    },
    [join, resetKnock]
  );

  /** The driver reported an ending (removed, ended, dropped). */
  const noteDriverEnd = useCallback((ending: SessionEnd) => {
    setSessionEnd((existing) => existing ?? ending);
    setGrant(null);
  }, []);

  return {
    grant,
    failure,
    joining,
    sessionEnd,
    knock,
    /** Where the control-token routes go: the room, or a booking call's room once it has joined. */
    room,
    /** A booking call's embed token, for Cal chat. Null for rooms. */
    embedToken,
    emailRequired,
    /** The speech-processing checkbox the pre-join must show before the next join; null for none. */
    speechConsentPrompt,
    /** The web's message for a refused tick ("reload" or "retry"); null when there's none. */
    speechConsentRefusal,
    join,
    retryKnock,
    leave,
    end,
    rejoin,
    joinAgain,
    noteDriverEnd,
    setFailure,
  };
}

/** Admission on the web app, then the session join on the video origin. */
async function joinBookingCall(
  call: CalVideoBookingCall,
  input: {
    name: string;
    email: string | null;
    accessToken: string | null;
    speechConsent: GuestSpeechConsent | null;
  }
): Promise<
  | { kind: "admitted"; grant: JoinGrant; room: RoomRef; embedToken: string }
  | { kind: "email-required" }
  | { kind: "consent-required" }
  | { kind: "consent-refused"; refusal: SpeechConsentRefusal }
  | { kind: "failure"; failure: JoinFailure }
> {
  const admission = await admitToBooking({
    call,
    displayName: input.name,
    email: input.email,
    accessToken: input.accessToken,
  });
  if (admission.kind !== "admitted") return admission;
  const session = await joinBookingSession({
    call,
    sessionId: admission.sessionId,
    token: admission.token,
    ...(input.speechConsent ? { speechConsent: input.speechConsent } : {}),
  });
  if (session.kind !== "admitted") return session;
  return {
    kind: "admitted",
    grant: session.grant,
    room: { origin: call.videoOrigin, slug: session.roomSlug },
    embedToken: admission.token,
  };
}
