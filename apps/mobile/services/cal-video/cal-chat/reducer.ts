import type { CalChatMessage, CalChatParticipant, CalChatPin, CalChatReactionEmoji } from "./types";

/** A send of yours the server has not stored yet, or refused. */
export type PendingSend = {
  clientKey: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
  replyToMessageId?: string;
};

export interface CalChatRoomState {
  /** Stored messages by seq, oldest first. */
  messages: CalChatMessage[];
  pending: PendingSend[];
  pin: CalChatPin | null;
  locked: boolean;
  /** The viewer's own mute. */
  muted: boolean;
  members: CalChatParticipant[];
  hasOlder: boolean;
  /** The server's read watermark for this viewer, moved by acks. */
  readSeq: number;
}

export const EMPTY_CAL_CHAT: CalChatRoomState = {
  messages: [],
  pending: [],
  pin: null,
  locked: false,
  muted: false,
  members: [],
  hasOlder: false,
  readSeq: 0,
};

/** The most messages held at once; older ones reload on scroll, as on the web. */
export const CAL_CHAT_HELD_LIMIT = 500;

function bySeq(left: CalChatMessage, right: CalChatMessage): number {
  return left.seq - right.seq;
}

/**
 * Folds stored messages into the list: a message already held is replaced (a reconnect re-reads
 * the newest page, which may carry fresh reactions or a deletion), a new one takes its place by
 * seq, and a pending send it confirms leaves the pending list.
 */
export function mergeMessages(
  state: CalChatRoomState,
  incoming: readonly CalChatMessage[]
): CalChatRoomState {
  if (incoming.length === 0) return state;
  const byId = new Map(state.messages.map((message) => [message.id, message]));
  const keys = new Set(incoming.map((message) => message.clientKey));
  for (const message of incoming) {
    const held = byId.get(message.id);
    // A live frame carries no reactions; keep the ones a history read gave us.
    byId.set(
      message.id,
      held && !message.reactions ? { ...message, reactions: held.reactions } : message
    );
  }
  const messages = [...byId.values()].sort(bySeq);
  const trimmed =
    messages.length > CAL_CHAT_HELD_LIMIT
      ? messages.slice(messages.length - CAL_CHAT_HELD_LIMIT)
      : messages;
  return {
    ...state,
    messages: trimmed,
    hasOlder: trimmed.length < messages.length || state.hasOlder,
    pending: state.pending.filter((send) => !keys.has(send.clientKey)),
  };
}

export function deleteMessage(
  state: CalChatRoomState,
  input: { id: string; reason: "sender" | "moderator" }
): CalChatRoomState {
  const index = state.messages.findIndex((message) => message.id === input.id);
  if (index === -1) return state;
  const messages = [...state.messages];
  const held = messages[index];
  messages[index] = { ...held, body: "", deletion: { reason: input.reason }, reactions: [] };
  // Deleting a pinned message unpins it.
  const pin = state.pin?.messageId === input.id ? null : state.pin;
  return { ...state, messages, pin };
}

/**
 * One emoji's new total on a message. `mine` follows `active` only when the frame names the
 * viewer; a relayed total carries neither and leaves the viewer's own mark alone.
 */
export function applyReaction(
  state: CalChatRoomState,
  input: {
    messageId: string;
    emoji: CalChatReactionEmoji;
    count: number;
    mine?: boolean;
  }
): CalChatRoomState {
  const index = state.messages.findIndex((message) => message.id === input.messageId);
  if (index === -1) return state;
  const held = state.messages[index];
  const reactions = held.reactions ?? [];
  const existing = reactions.find((reaction) => reaction.emoji === input.emoji);
  const mine = input.mine ?? existing?.mine ?? false;
  const next = reactions.filter((reaction) => reaction.emoji !== input.emoji);
  if (input.count > 0) next.push({ emoji: input.emoji, count: input.count, mine });
  const messages = [...state.messages];
  messages[index] = { ...held, reactions: next };
  return { ...state, messages };
}

/** The viewer toggling their own emoji, shown at once; the server's total replaces it. */
export function toggleOwnReaction(
  state: CalChatRoomState,
  input: { messageId: string; emoji: CalChatReactionEmoji }
): { state: CalChatRoomState; active: boolean } {
  const held = state.messages.find((message) => message.id === input.messageId);
  const existing = held?.reactions?.find((reaction) => reaction.emoji === input.emoji);
  const active = !existing?.mine;
  const count = Math.max(0, (existing?.count ?? 0) + (active ? 1 : -1));
  return { state: applyReaction(state, { ...input, count, mine: active }), active };
}

export function setMemberMuted(
  state: CalChatRoomState,
  input: { participantId: string; muted: boolean; viewerId: string | null }
): CalChatRoomState {
  const members = state.members.map((member) =>
    member.participantId === input.participantId ? { ...member, muted: input.muted } : member
  );
  const muted = input.participantId === input.viewerId ? input.muted : state.muted;
  return { ...state, members, muted };
}

export function memberJoined(
  state: CalChatRoomState,
  member: CalChatParticipant
): CalChatRoomState {
  const others = state.members.filter((held) => held.participantId !== member.participantId);
  return { ...state, members: [...others, member] };
}

export function memberLeft(state: CalChatRoomState, participantId: string): CalChatRoomState {
  if (!state.members.some((member) => member.participantId === participantId)) return state;
  return {
    ...state,
    members: state.members.filter((member) => member.participantId !== participantId),
  };
}

export function addPending(
  state: CalChatRoomState,
  send: Omit<PendingSend, "status">
): CalChatRoomState {
  return { ...state, pending: [...state.pending, { ...send, status: "sending" }] };
}

export function setPendingStatus(
  state: CalChatRoomState,
  input: { clientKey: string; status: PendingSend["status"] }
): CalChatRoomState {
  return {
    ...state,
    pending: state.pending.map((send) =>
      send.clientKey === input.clientKey ? { ...send, status: input.status } : send
    ),
  };
}

export function removePending(state: CalChatRoomState, clientKey: string): CalChatRoomState {
  return { ...state, pending: state.pending.filter((send) => send.clientKey !== clientKey) };
}

/** The newest stored seq, or 0 in an empty room. */
export function newestSeq(state: Pick<CalChatRoomState, "messages">): number {
  return state.messages.at(-1)?.seq ?? 0;
}

/**
 * Where the stored sequence skips a number: a frame arrived for a message whose predecessors
 * never did, so a read forward from the last continuous seq is due.
 */
export function firstGapAfter(messages: readonly CalChatMessage[], fromSeq: number): number | null {
  let expected = fromSeq;
  for (const message of messages) {
    if (message.seq <= expected) continue;
    if (message.seq !== expected + 1) return expected;
    expected = message.seq;
  }
  return null;
}

/** Stored messages from others past both the seq last shown in the open panel and the read watermark. */
export function countCalChatUnread(input: {
  messages: readonly CalChatMessage[];
  viewerId: string | null;
  lastSeenSeq: number;
  readSeq: number;
}): number {
  const seen = Math.max(input.lastSeenSeq, input.readSeq);
  return input.messages.filter(
    (message) =>
      message.seq > seen &&
      message.speaker.participantId !== input.viewerId &&
      !message.deletion &&
      (message.kind ?? "text") === "text"
  ).length;
}
