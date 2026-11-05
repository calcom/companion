import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatController, ChatRow } from "@/services/cal-video/chat-controller";
import { countUnreadMessages } from "@/services/cal-video/chat-message";
import {
  type CallDriver,
  type CallState,
  CHAT_MESSAGE_MAX_LENGTH,
} from "@/services/cal-video/types";

type FailedSend = { id: string; text: string; at: number };

/**
 * The provider's chat (RealtimeKit, Daily) behind the chat sheet. The driver echoes successful
 * sends into `state.messages`; only a refusal is kept here, so the viewer can retry it. Nothing a
 * provider message cannot carry is offered.
 */
export function useProviderChat(input: {
  driver: CallDriver | null;
  state: Pick<CallState, "messages" | "participants">;
  open: boolean;
}): ChatController | null {
  const { driver, state, open } = input;
  const sendChatMessage = driver?.signals.chat ? driver.sendChatMessage?.bind(driver) : undefined;
  const [failed, setFailed] = useState<FailedSend[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState(() => Date.now());
  const failedRef = useRef(failed);
  useEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  const participants = state.participants;
  const rows = useMemo<ChatRow[]>(() => {
    const roleOf = (id: string | null) =>
      participants.find((participant) => participant.id === id)?.role === "host";
    const local = participants.find((participant) => participant.isLocal);
    const stored = state.messages.map(
      (message, index): ChatRow => ({
        id: message.id,
        seq: index + 1,
        senderId: message.senderId,
        senderName: message.senderName,
        isLocal: message.isLocal,
        isHost: roleOf(message.senderId),
        text: message.text,
        at: message.at,
        status: "sent",
        deleted: false,
        kind: "text",
        reactions: [],
        replyTo: null,
      })
    );
    const unsent = failed.map(
      (send): ChatRow => ({
        id: send.id,
        seq: stored.length,
        senderId: local?.id ?? null,
        senderName: local?.displayName ?? "You",
        isLocal: true,
        isHost: local?.role === "host",
        text: send.text,
        at: send.at,
        status: "failed",
        deleted: false,
        kind: "text",
        reactions: [],
        replyTo: null,
      })
    );
    return [...stored, ...unsent];
  }, [state.messages, participants, failed]);

  const send = useCallback(
    (text: string) => {
      void sendChatMessage?.(text).catch(() =>
        setFailed((current) => [
          ...current,
          { id: `failed:${Date.now()}:${current.length}`, text, at: Date.now() },
        ])
      );
    },
    [sendChatMessage]
  );

  const retry = useCallback(
    (id: string) => {
      const unsent = failedRef.current.find((row) => row.id === id);
      if (!unsent) return;
      setFailed((current) => current.filter((row) => row.id !== id));
      send(unsent.text);
    },
    [send]
  );

  const markSeen = useCallback(() => setLastSeenAt(Date.now()), []);
  const unread = open ? 0 : countUnreadMessages({ messages: state.messages, lastSeenAt });

  if (!sendChatMessage) return null;
  return {
    kind: "provider",
    rows,
    unread,
    connection: "live",
    locked: false,
    muted: false,
    canModerate: false,
    hasOlder: false,
    pin: null,
    capabilities: {
      react: false,
      pin: false,
      lock: false,
      deleteOwn: false,
      mute: false,
      reply: false,
    },
    typingLabel: null,
    seenBy: null,
    replyingTo: null,
    maxBodyLength: CHAT_MESSAGE_MAX_LENGTH,
    send,
    retry,
    markSeen,
  };
}
