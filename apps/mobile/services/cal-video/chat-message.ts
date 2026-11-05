import { CalVideoError, CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from "./types";

/** Enough to read back through a meeting; small enough that a flood cannot grow the state. */
export const CHAT_HISTORY_LIMIT = 500;

/** Appends and drops the oldest past the limit. A new array, because state is compared by identity. */
export function appendChatMessage(
  messages: readonly ChatMessage[],
  message: ChatMessage
): ChatMessage[] {
  const next = [...messages, message];
  return next.length > CHAT_HISTORY_LIMIT ? next.slice(next.length - CHAT_HISTORY_LIMIT) : next;
}

/**
 * The body a driver may send, or a rejection. Rejected rather than trimmed to fit: a message
 * silently cut short is one the sender believes was delivered whole.
 */
export function outgoingChatText(text: string): string {
  const body = text.trim();
  if (body.length === 0) {
    throw new CalVideoError("invalid-message", "A chat message cannot be empty");
  }
  if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new CalVideoError(
      "invalid-message",
      `A chat message cannot exceed ${CHAT_MESSAGE_MAX_LENGTH} characters`
    );
  }
  return body;
}

/**
 * Messages from others newer than what the viewer has seen: the last one on screen while the chat
 * was open, or the server's read watermark, whichever is later.
 */
export function countUnreadMessages(input: {
  messages: readonly { id: string; isLocal: boolean; at: number }[];
  lastSeenAt: number;
}): number {
  return input.messages.filter((message) => !message.isLocal && message.at > input.lastSeenAt)
    .length;
}
