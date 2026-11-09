/**
 * The Cal Video room API, as the web app's `use-room-session` and `use-knock` call it.
 *
 * Every call is against the room's own origin (`https://i.cal.video`), never a Cal.com API host:
 * the org namespace lives in the hostname. Cookies the server sets (`cvi`, the per-device
 * identity) persist in the native cookie jar, so a re-join is recognised as the same person.
 */
import { fetchWithTimeout } from "@/utils/network";
import { transcriptionStateSchema, type TranscriptionState } from "./cal-chat/types";
import { joinGrantSchema } from "./join-grant-schema";
import type { JoinFailure } from "./room-screen";
import type { JoinGrant } from "./types";
import type { WaitingEntry } from "./waiting-list";

const JOIN_TIMEOUT_MS = 20_000;
const POLL_TIMEOUT_MS = 10_000;

export interface RoomRef {
  origin: string;
  slug: string;
}

export interface JoinRequest extends RoomRef {
  displayName: string;
  inviteToken?: string | null;
  /**
   * The signed-in user's Cal.com OAuth access token. cal.video today identifies a viewer only by
   * its own browser cookie, so this is forwarded for the server to adopt (`Authorization: Bearer`)
   * and lets the room owner join as host from the app once it does. Harmless where ignored.
   */
  accessToken?: string | null;
}

export type JoinResult =
  | { kind: "admitted"; grant: JoinGrant }
  | { kind: "knock" }
  | { kind: "failure"; failure: JoinFailure };

export type KnockResult =
  | { outcome: "waiting"; expiresInSeconds: number }
  | { outcome: "admitted" }
  | { outcome: "open" }
  | { outcome: "unavailable" }
  | { outcome: "lobby-full" }
  | { outcome: "not-found" }
  | { outcome: "rate-limited" }
  | { outcome: "error" };

export type KnockStatusResult =
  | { state: "pending" | "denied" | "expired" | "invalid" | "open" }
  | { state: "admitted" }
  | { state: "gone" }
  | { state: "error" };

function roomUrl(room: RoomRef, path: string): string {
  return `${room.origin}/api/rooms/${encodeURIComponent(room.slug)}/${path}`;
}

function headersFor(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function joinRoom(request: JoinRequest): Promise<JoinResult> {
  const response = await fetchWithTimeout(
    roomUrl(request, "join"),
    {
      method: "POST",
      headers: headersFor(request.accessToken),
      body: JSON.stringify({
        displayName: request.displayName,
        inviteToken: request.inviteToken || undefined,
      }),
    },
    JOIN_TIMEOUT_MS
  );

  if (!response.ok) {
    if (response.status === 429) return { kind: "failure", failure: "rate-limited" };
    const body = await readJson(response);
    const outcome = body.outcome;
    if (outcome === "knock") return { kind: "knock" };
    if (outcome === "not-found" || response.status === 404) {
      return { kind: "failure", failure: "not-found" };
    }
    if (outcome === "full") return { kind: "failure", failure: "full" };
    return { kind: "failure", failure: "error" };
  }

  const body = await readJson(response);
  const parsed = joinGrantSchema.safeParse(body.grant);
  if (!parsed.success) return { kind: "failure", failure: "error" };
  return { kind: "admitted", grant: parsed.data };
}

export async function knockRoom(room: RoomRef, displayName: string): Promise<KnockResult> {
  const response = await fetchWithTimeout(
    roomUrl(room, "knock"),
    { method: "POST", headers: headersFor(), body: JSON.stringify({ displayName }) },
    JOIN_TIMEOUT_MS
  );
  const body = await readJson(response);
  if (response.status === 429 && body.outcome !== "lobby-full") return { outcome: "rate-limited" };
  // The `cvi` cookie this response sets is what identifies the knock on every later poll.
  if (body.outcome === "waiting" && typeof body.expiresInSeconds === "number") {
    return { outcome: "waiting", expiresInSeconds: body.expiresInSeconds };
  }
  if (body.outcome === "admitted") return { outcome: "admitted" };
  if (body.outcome === "open") return { outcome: "open" };
  if (body.outcome === "unavailable") return { outcome: "unavailable" };
  if (body.outcome === "lobby-full") return { outcome: "lobby-full" };
  if (body.outcome === "not-found" || response.status === 404) return { outcome: "not-found" };
  return { outcome: "error" };
}

export async function knockStatus(room: RoomRef): Promise<KnockStatusResult> {
  const response = await fetchWithTimeout(
    roomUrl(room, "knock/status"),
    { method: "POST", headers: headersFor() },
    POLL_TIMEOUT_MS
  );
  // The meeting ended and took its lobby with it.
  if (response.status === 404) return { state: "gone" };
  const body = await readJson(response);
  if (
    body.state === "admitted" ||
    body.state === "pending" ||
    body.state === "denied" ||
    body.state === "expired" ||
    body.state === "invalid" ||
    body.state === "open"
  ) {
    return { state: body.state };
  }
  return { state: "error" };
}

/** Tells the server to drop our connection; a vendor SDK cannot always finish leaving itself. */
export async function leaveRoom(room: RoomRef, controlToken: string): Promise<void> {
  try {
    await fetchWithTimeout(
      roomUrl(room, "leave"),
      { method: "POST", headers: headersFor(), body: JSON.stringify({ controlToken }) },
      POLL_TIMEOUT_MS
    );
  } catch {
    // Best effort, like the web beacon.
  }
}

/** Host only. Resolves on 2xx; rejects otherwise so the caller keeps the host in the meeting. */
export async function endMeeting(room: RoomRef, controlToken: string): Promise<void> {
  const response = await fetchWithTimeout(
    roomUrl(room, "end"),
    { method: "POST", headers: headersFor(), body: JSON.stringify({ controlToken }) },
    JOIN_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Ending the meeting failed with ${response.status}`);
}

// ---------------------------------------------------------------------------------------------
// Host actions. Every one is authorised by the grant's control token, re-checked server-side.
// ---------------------------------------------------------------------------------------------

async function hostPost(
  room: RoomRef,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = POLL_TIMEOUT_MS
): Promise<Response> {
  return fetchWithTimeout(
    roomUrl(room, path),
    { method: "POST", headers: headersFor(), body: JSON.stringify(body) },
    timeoutMs
  );
}

/** Everyone still waiting at the door, oldest first. Rejects on anything but a readable list. */
export async function readWaitingList(
  room: RoomRef,
  controlToken: string
): Promise<WaitingEntry[]> {
  const response = await hostPost(room, "waiting", { controlToken });
  if (!response.ok) throw new Error(`Reading the lobby failed with ${response.status}`);
  const body = await readJson(response);
  const knocks = Array.isArray(body.knocks) ? (body.knocks as unknown[]) : [];
  return knocks.flatMap((knock) => {
    if (!knock || typeof knock !== "object") return [];
    const entry = knock as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.attempt !== "number" ||
      typeof entry.displayName !== "string"
    ) {
      return [];
    }
    return [{ id: entry.id, attempt: entry.attempt, displayName: entry.displayName }];
  });
}

/** A host's answer to one knock. Resolves on any 2xx: decided, decided by another host, or stale. */
export async function decideKnock(
  room: RoomRef,
  input: {
    controlToken: string;
    entry: Pick<WaitingEntry, "id" | "attempt">;
    decision: "admit" | "deny";
  }
): Promise<void> {
  const response = await hostPost(room, "admit", {
    controlToken: input.controlToken,
    id: input.entry.id,
    attempt: input.entry.attempt,
    decision: input.decision,
  });
  if (!response.ok) throw new Error(`Deciding a knock failed with ${response.status}`);
}

/** Removes one person from the live session and keeps them out for as long as it lasts. */
export async function removeParticipant(
  room: RoomRef,
  input: { controlToken: string; participantId: string }
): Promise<void> {
  const response = await hostPost(room, "remove", input);
  if (!response.ok) throw new Error(`Removing a participant failed with ${response.status}`);
}

/** Starts or stops the provider's cloud recording for everyone. */
export async function setRecording(
  room: RoomRef,
  input: { controlToken: string; action: "start" | "stop" }
): Promise<void> {
  const response = await hostPost(room, "recording", input, JOIN_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Recording could not be updated (${response.status})`);
}

export async function setTranscription(
  room: RoomRef,
  input: { controlToken: string; action: "start" | "stop" }
): Promise<TranscriptionState> {
  const response = await hostPost(room, "transcription", input, JOIN_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Captions could not be updated (${response.status})`);
  const body = await readJson(response);
  return transcriptionStateSchema.parse(body.state);
}

/** Switches the room between knocking and walking in. Returns the mode the room is actually in. */
export async function setRequireApproval(
  room: RoomRef,
  input: { controlToken: string; requireApproval: boolean }
): Promise<boolean> {
  const response = await hostPost(room, "access", input);
  if (!response.ok) throw new Error(`Changing who can join failed with ${response.status}`);
  const body = await readJson(response);
  if (typeof body.requireApproval !== "boolean") throw new Error("Unexpected access response");
  return body.requireApproval;
}

/** Mints a shareable link that admits anyone holding it without knocking. Host only. */
export async function mintInviteLink(room: RoomRef, controlToken: string): Promise<string> {
  const response = await hostPost(
    room,
    "invites",
    { role: "participant", shared: true, controlToken },
    JOIN_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Minting an invite failed with ${response.status}`);
  const body = await readJson(response);
  if (typeof body.url !== "string") throw new Error("Unexpected invite response");
  return body.url;
}
