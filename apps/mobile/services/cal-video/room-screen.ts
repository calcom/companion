import type { CallStatus } from "./types";

/** Mirrors the web app's `room-screen.ts` so both surfaces tell the same story. */
export type JoinFailure = "not-found" | "full" | "rate-limited" | "unsupported" | "error";
export type RoomFailure = JoinFailure | "disconnected";
export type SessionEnd = "left" | "removed" | "ended";

export type KnockState =
  | { status: "idle" }
  | { status: "waiting"; until: number }
  | { status: "admitted" }
  | { status: "denied" }
  | { status: "unanswered" }
  | { status: "open" }
  | { status: "unavailable" }
  | { status: "lobby-full" }
  | { status: "rate-limited" }
  | { status: "error" };

export type ActiveKnock = Exclude<KnockState, { status: "idle" } | { status: "open" }>;

export type RoomScreen =
  | { kind: "failure"; failure: RoomFailure }
  | { kind: "ended"; status: SessionEnd }
  | { kind: "knock"; state: ActiveKnock }
  | { kind: "prejoin" }
  | { kind: "call" };

function isSessionEnd(status: CallStatus): status is SessionEnd {
  return status === "left" || status === "removed" || status === "ended";
}

export function isActiveKnock(state: KnockState): state is ActiveKnock {
  return state.status !== "idle" && state.status !== "open";
}

/**
 * Which room surface to show. Ending beats knocking: a leftover admission must not show
 * "connecting" to someone who just left.
 */
export function resolveRoomScreen(input: {
  failure: RoomFailure | null;
  sessionEnd: SessionEnd | null;
  callStatus: CallStatus;
  hasGrant: boolean;
  knock: KnockState;
}): RoomScreen {
  if (input.failure) return { kind: "failure", failure: input.failure };
  if (input.sessionEnd) return { kind: "ended", status: input.sessionEnd };
  if (isSessionEnd(input.callStatus)) return { kind: "ended", status: input.callStatus };
  if (input.callStatus === "error") return { kind: "failure", failure: "disconnected" };
  if (!input.hasGrant && isActiveKnock(input.knock)) return { kind: "knock", state: input.knock };
  if (!input.hasGrant) return { kind: "prejoin" };
  return { kind: "call" };
}

/** Only the pre-join screen holds the camera; anywhere else the light would be on for nothing. */
export function holdsPreview(screen: RoomScreen): boolean {
  return screen.kind === "prejoin";
}
