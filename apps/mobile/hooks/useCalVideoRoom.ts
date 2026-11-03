import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endMeeting, joinRoom, knockRoom, knockStatus, leaveRoom } from "@/services/cal-video/api";
import type { KnockState, RoomFailure, SessionEnd } from "@/services/cal-video/room-screen";
import type { JoinGrant } from "@/services/cal-video/types";
import type { CalVideoRoomLink } from "@/utils/cal-video-links";
import { safeLogWarn } from "@/utils/safeLogger";

/** The knocker is looking straight at the screen, so this is the one poll worth running hot. */
const KNOCK_POLL_MS = 2_000;

/**
 * Getting into a room, waiting at its door, and getting out again — the app-side port of the web
 * app's `useRoomSession` + `useKnock`. Everything about how the call *looks* lives elsewhere.
 */
export function useCalVideoRoom({
  link,
  accessToken,
  beforeGrant,
}: {
  link: CalVideoRoomLink;
  accessToken: string | null;
  /** Runs just before a grant is stored, to release anything the driver is about to need. */
  beforeGrant?: () => void;
}) {
  const { origin, slug } = link;
  const room = useMemo(() => ({ origin, slug }), [origin, slug]);
  const [grant, setGrant] = useState<JoinGrant | null>(null);
  const [failure, setFailure] = useState<RoomFailure | null>(null);
  const [joining, setJoining] = useState(false);
  const [sessionEnd, setSessionEnd] = useState<SessionEnd | null>(null);
  const [knock, setKnock] = useState<KnockState>({ status: "idle" });
  const receipt = useRef<string | null>(null);
  const knockedAs = useRef<string | null>(null);
  const joinedAs = useRef<string | null>(null);
  const actedOn = useRef<string | null>(null);
  const beforeGrantRef = useRef(beforeGrant);
  const roomRef = useRef(room);
  const accessTokenRef = useRef(accessToken);
  const inviteTokenRef = useRef(link.inviteToken);
  useEffect(() => {
    beforeGrantRef.current = beforeGrant;
    roomRef.current = room;
    accessTokenRef.current = accessToken;
    inviteTokenRef.current = link.inviteToken;
  }, [beforeGrant, room, accessToken, link.inviteToken]);

  const resetKnock = useCallback(() => {
    receipt.current = null;
    setKnock({ status: "idle" });
  }, []);

  const startKnock = useCallback(async (displayName: string) => {
    try {
      const result = await knockRoom(roomRef.current, displayName);
      switch (result.outcome) {
        case "waiting":
          receipt.current = result.receipt;
          setKnock({ status: "waiting", until: Date.now() + result.expiresInSeconds * 1000 });
          return;
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
      const token = receipt.current;
      if (!token) return;
      const status = await knockStatus(roomRef.current, token).catch(() => null);
      if (cancelled) return;
      if (status === null) {
        // Network hiccup: keep polling until the knock itself expires.
        if (Date.now() >= until) return setKnock({ status: "unanswered" });
      } else {
        if (status.state === "gone") return setKnock({ status: "unanswered" });
        if (status.state === "admitted")
          return setKnock({ status: "admitted", ticket: status.ticket });
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

  const join = useCallback(
    async (name: string, admissionTicket?: string) => {
      setJoining(true);
      setFailure(null);
      joinedAs.current = name;
      const result = await joinRoom({
        ...roomRef.current,
        displayName: name,
        inviteToken: inviteTokenRef.current,
        admissionTicket,
        accessToken: accessTokenRef.current,
      }).catch(() => null);
      if (result === null) {
        setFailure("error");
      } else if (result.kind === "knock") {
        knockedAs.current = name;
        await startKnock(name);
      } else if (result.kind === "failure") {
        setFailure(result.failure);
      } else {
        safeLogWarn("[CalVideo] admitted", {
          transport: result.grant.transport,
          provider: result.grant.transport === "sfu" ? result.grant.provider : "loopback",
          role: result.grant.role,
          chat: result.grant.chat ?? "unset",
        });
        beforeGrantRef.current?.();
        setGrant(result.grant);
        resetKnock();
      }
      setJoining(false);
    },
    [startKnock, resetKnock]
  );

  // Act on a host's answer at once rather than asking the person to press Join again.
  useEffect(() => {
    const name = knockedAs.current;
    if (!name) return;
    if (knock.status === "open" && actedOn.current !== "open") {
      actedOn.current = "open";
      void join(name);
      return;
    }
    if (knock.status !== "admitted" || actedOn.current === knock.ticket) return;
    actedOn.current = knock.ticket;
    void join(name, knock.ticket);
  }, [knock, join]);

  const retryKnock = useCallback(() => {
    if (knockedAs.current) void join(knockedAs.current);
  }, [join]);

  const leave = useCallback(() => {
    const current = grant;
    setSessionEnd((existing) => existing ?? "left");
    resetKnock();
    setGrant(null);
    if (current) void leaveRoom(roomRef.current, current.controlToken);
  }, [grant, resetKnock]);

  const end = useCallback(async () => {
    if (!grant) throw new Error("No grant to end this meeting with");
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
      const name = joinedAs.current;
      if (!name) return;
      setSessionEnd(ending);
      actedOn.current = null;
      resetKnock();
      setGrant(null);
      await join(name);
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
