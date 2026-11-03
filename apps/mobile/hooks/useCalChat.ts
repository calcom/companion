import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  type CalChatApi,
  CalChatRequestError,
  createCalChatApi,
} from "@/services/cal-video/cal-chat/api";
import {
  advanceReceipts,
  pruneTypers,
  type ReadReceipts,
  noteTyping as reduceTyping,
  seenByLabel,
  TYPING_HEARTBEAT_MS,
  type Typers,
  typingLabel,
} from "@/services/cal-video/cal-chat/presence";
import {
  addPending,
  applyReaction,
  CAL_CHAT_HELD_LIMIT,
  type CalChatRoomState,
  countCalChatUnread,
  EMPTY_CAL_CHAT,
  memberJoined,
  memberLeft,
  mergeMessages,
  newestSeq,
  deleteMessage as reduceDelete,
  setMemberMuted,
  setPendingStatus,
  toggleOwnReaction,
} from "@/services/cal-video/cal-chat/reducer";
import {
  type CalChatConnection,
  CalChatSocketClient,
} from "@/services/cal-video/cal-chat/socket-client";
import {
  type CalChatMessage,
  type CalChatReactionEmoji,
  type CalChatServerFrame,
  frameSubject,
} from "@/services/cal-video/cal-chat/types";
import type { ChatController, ChatRow } from "@/services/cal-video/chat-controller";
import { safeLogWarn } from "@/utils/safeLogger";

/** The server caps a body at 4000; the composer stops there too. */
const CAL_CHAT_MAX_BODY = 4000;
/** At most one ack per interval, carrying the furthest delivered and read seqs. */
const ACK_INTERVAL_MS = 2_000;
/** A reconnect reads forward at most this many pages (500 messages), then stops. */
const MAX_GAP_FILL_PAGES = 10;
/** While the socket is not live, the newest messages are read this often so chat still moves. */
const FALLBACK_POLL_MS = 4_000;

export type CalChatViewer = { displayName: string; role: "host" | "guest" };

function socketUrlFor(origin: string): string {
  return `${origin.replace(/^http/, "ws")}/api/chat/socket`;
}

function toRow(message: CalChatMessage, viewerId: string | null): ChatRow {
  return {
    id: message.id,
    seq: message.seq,
    senderId: message.speaker.participantId,
    senderName: message.speaker.displayName ?? "Guest",
    isLocal: message.speaker.participantId === viewerId,
    isHost: message.speaker.isHost,
    text: message.body,
    at: Date.parse(message.createdAt) || Date.now(),
    status: "sent",
    deleted: Boolean(message.deletion),
    kind: message.kind ?? "text",
    reactions: message.reactions ?? [],
    replyTo: message.replyTo
      ? {
          speakerName: message.replyTo.speakerName,
          excerpt: message.replyTo.excerpt,
          deleted: message.replyTo.deleted,
        }
      : null,
  };
}

/**
 * Cal Video's own durable chat for one call session: a state read, the newest history page,
 * live frames over the gateway socket with gap repair after a reconnect, optimistic sends keyed
 * by `clientKey`, reactions, the pin, the lock and mutes. Null until the session's chat state has
 * loaded. A port of the web's shared room-chat session, cut to what the sheet shows.
 */
export function useCalChat(input: {
  origin: string;
  /** Null while there is no grant, or when the session is on the provider's chat: nothing is fetched. */
  sessionId: string | null;
  viewer: CalChatViewer | null;
  open: boolean;
}): ChatController | null {
  const { origin, sessionId, viewer, open } = input;
  const api = useMemo<CalChatApi | null>(
    () => (sessionId ? createCalChatApi({ origin, sessionId }) : null),
    [origin, sessionId]
  );
  const [room, setRoom] = useState<CalChatRoomState>(EMPTY_CAL_CHAT);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<CalChatConnection>("connecting");
  const [lastSeenSeq, setLastSeenSeq] = useState(0);
  const [typers, setTypers] = useState<Typers>(new Map());
  const [receipts, setReceipts] = useState<ReadReceipts>(new Map());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const typingSentAt = useRef<number | null>(null);
  const roomRef = useRef(room);
  const openRef = useRef(open);
  const socketRef = useRef<CalChatSocketClient | null>(null);
  const ackSent = useRef({ deliveredSeq: 0, readSeq: 0, at: 0 });
  const gapFilling = useRef(false);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // --- Reads ---------------------------------------------------------------------------------
  const readState = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    const state = await api.getState().catch(() => null);
    if (!state) return false;
    setViewerId(state.participantId);
    setRoom((current) => ({
      ...current,
      locked: state.locked,
      muted: state.muted,
      readSeq: state.readSeq,
      members: state.members,
    }));
    return true;
  }, [api]);

  const readNewest = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    const page = await api.getHistory({}).catch(() => null);
    if (!page) return false;
    setRoom((current) => ({
      ...mergeMessages(current, page.messages),
      pin: page.pin === undefined ? current.pin : page.pin,
      hasOlder: page.hasOlder,
    }));
    return true;
  }, [api]);

  /** Reads forward from the last continuous seq until the server has nothing newer. */
  const fillGap = useCallback(
    async (fromSeq: number) => {
      if (!api || gapFilling.current) return;
      gapFilling.current = true;
      let afterSeq = fromSeq;
      for (let page = 0; page < MAX_GAP_FILL_PAGES; page++) {
        const result = await api.getHistory({ afterSeq }).catch(() => null);
        if (!result) break;
        setRoom((current) => mergeMessages(current, result.messages));
        const last = result.messages.at(-1);
        if (!last || !result.hasNewer) break;
        afterSeq = last.seq;
      }
      gapFilling.current = false;
    },
    [api]
  );

  // --- Frames --------------------------------------------------------------------------------
  const onFrame = useCallback(
    (frame: CalChatServerFrame) => {
      switch (frame.type) {
        case "ready":
          return;
        case "message": {
          const expected = newestSeq(roomRef.current) + 1;
          setRoom((current) => mergeMessages(current, [frame.message]));
          // Their message is what they were typing.
          setTypers((current) =>
            reduceTyping(current, {
              participantId: frame.message.speaker.participantId,
              active: false,
              now: Date.now(),
            })
          );
          // Its predecessors never arrived: read forward from the last continuous seq.
          if (frame.message.seq > expected) void fillGap(expected - 1);
          return;
        }
        case "message.deleted":
          setRoom((current) => reduceDelete(current, { id: frame.id, reason: frame.reason }));
          return;
        case "reaction": {
          const subject = frameSubject(frame);
          setRoom((current) =>
            applyReaction(current, {
              messageId: frame.messageId,
              emoji: frame.emoji,
              count: frame.count,
              mine: subject !== null && subject === viewerId ? frame.active : undefined,
            })
          );
          return;
        }
        case "pin":
          setRoom((current) => ({ ...current, pin: frame.pin }));
          return;
        case "locked":
          setRoom((current) => ({ ...current, locked: frame.locked }));
          return;
        case "member.muted": {
          const subject = frameSubject(frame);
          if (subject) {
            setRoom((current) =>
              setMemberMuted(current, { participantId: subject, muted: frame.muted, viewerId })
            );
          }
          return;
        }
        case "member.joined":
          setRoom((current) => memberJoined(current, frame.member));
          return;
        case "member.left":
        case "member.removed": {
          const subject = frameSubject(frame);
          if (subject) setRoom((current) => memberLeft(current, subject));
          if (frame.type === "member.removed" && subject === viewerId) setConnection("denied");
          return;
        }
        case "typing": {
          const subject = frameSubject(frame);
          if (subject && subject !== viewerId) {
            setTypers((current) =>
              reduceTyping(current, {
                participantId: subject,
                active: frame.active,
                now: Date.now(),
              })
            );
          }
          return;
        }
        case "receipts":
          setReceipts((current) =>
            advanceReceipts(
              current,
              frame.receipts.flatMap((receipt) => {
                const subject = frameSubject(receipt);
                return subject ? [{ participantId: subject, readSeq: receipt.readSeq }] : [];
              })
            )
          );
          return;
        default:
          return;
      }
    },
    [fillGap, viewerId]
  );
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // --- Lifecycle -----------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session starts with nothing from the last one
  useEffect(() => {
    setRoom(EMPTY_CAL_CHAT);
    setViewerId(null);
    setReady(false);
    setLastSeenSeq(0);
    setTypers(new Map());
    setReceipts(new Map());
    setReplyingTo(null);
    setConnection("connecting");
  }, [api]);

  // A typer whose heartbeats stop is dropped, so a lost stop frame cannot leave one behind.
  useEffect(() => {
    if (typers.size === 0) return;
    const timer = setInterval(
      () => setTypers((current) => pruneTypers(current, Date.now())),
      1_000
    );
    return () => clearInterval(timer);
  }, [typers]);

  useEffect(() => {
    if (!api || !viewer) return;
    let cancelled = false;
    let wasLive = false;
    const socket = new CalChatSocketClient({
      url: socketUrlFor(origin),
      fetchToken: () => api.getSocketToken(),
      onFrame: (frame) => {
        if (cancelled) return;
        if (frame.type === "ready") {
          // Every ready after the first is a reconnect, which re-reads the newest page.
          if (wasLive) void readNewest();
          wasLive = true;
        }
        onFrameRef.current(frame);
      },
      onConnection: (next) => {
        if (!cancelled) setConnection(next);
      },
      // Removal or chat turned off; a fresh state read decides whether the viewer may read again.
      onDenied: () => void readState(),
    });
    socketRef.current = socket;
    void (async () => {
      const stateOk = await readState();
      if (cancelled || !stateOk) return;
      await readNewest();
      if (cancelled) return;
      setReady(true);
      socket.start();
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") socket.retryNow();
    });
    return () => {
      cancelled = true;
      subscription.remove();
      socket.stop();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [api, viewer, origin, readState, readNewest]);

  // Without a live socket the newest page is polled, so a deployment with no gateway still chats.
  useEffect(() => {
    if (!ready || connection === "live" || connection === "denied") return;
    const timer = setInterval(() => void readNewest(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [ready, connection, readNewest]);

  // The panel is open: what is on screen is read, said to the server at most every two seconds.
  const newest = newestSeq(room);
  useEffect(() => {
    if (!open || newest === 0) return;
    setLastSeenSeq(newest);
    const now = Date.now();
    const sent = ackSent.current;
    if (newest <= sent.readSeq || now - sent.at < ACK_INTERVAL_MS) return;
    if (socketRef.current?.send({ type: "ack", deliveredSeq: newest, readSeq: newest })) {
      ackSent.current = { deliveredSeq: newest, readSeq: newest, at: now };
    }
  }, [open, newest]);

  // --- Actions -------------------------------------------------------------------------------
  const submit = useCallback(
    async (clientKey: string, body: string, replyToMessageId?: string) => {
      if (!api) return;
      const result: CalChatMessage | Error = await api
        .send({ body, clientKey, replyToMessageId })
        .then(
          (message) => message,
          (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
        );
      if (result instanceof Error) {
        if (result instanceof CalChatRequestError && result.reason === "chat_locked") {
          setRoom((current) => ({ ...current, locked: true }));
        }
        if (result instanceof CalChatRequestError && result.reason === "chat_muted") {
          setRoom((current) => ({ ...current, muted: true }));
        }
        setRoom((current) => setPendingStatus(current, { clientKey, status: "failed" }));
        return;
      }
      setRoom((current) => mergeMessages(current, [result]));
    },
    [api]
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body || body.length > CAL_CHAT_MAX_BODY) return;
      const clientKey = randomUUID();
      const quoted = replyingTo;
      setReplyingTo(null);
      typingSentAt.current = null;
      socketRef.current?.send({ type: "typing", active: false });
      setRoom((current) =>
        addPending(current, {
          clientKey,
          body,
          createdAt: new Date().toISOString(),
          replyToMessageId: quoted ?? undefined,
        })
      );
      void submit(clientKey, body, quoted ?? undefined);
    },
    [submit, replyingTo]
  );

  const retry = useCallback(
    (rowId: string) => {
      const clientKey = rowId.startsWith("pending:") ? rowId.slice("pending:".length) : null;
      const pending = clientKey
        ? roomRef.current.pending.find((send) => send.clientKey === clientKey)
        : undefined;
      if (!clientKey || !pending) return;
      setRoom((current) => setPendingStatus(current, { clientKey, status: "sending" }));
      void submit(clientKey, pending.body, pending.replyToMessageId);
    },
    [submit]
  );

  const markSeen = useCallback(() => setLastSeenSeq(newestSeq(roomRef.current)), []);

  const loadOlder = useCallback(() => {
    const oldest = roomRef.current.messages[0];
    if (!api || !oldest || roomRef.current.messages.length >= CAL_CHAT_HELD_LIMIT) return;
    void api
      .getHistory({ beforeSeq: oldest.seq })
      .then((page) =>
        setRoom((current) => ({
          ...mergeMessages(current, page.messages),
          hasOlder: page.hasOlder,
        }))
      )
      .catch(() => undefined);
  }, [api]);

  const react = useCallback(
    (rowId: string, emoji: CalChatReactionEmoji) => {
      if (!api || roomRef.current.muted || roomRef.current.locked) return;
      const before = roomRef.current;
      const toggled = toggleOwnReaction(before, { messageId: rowId, emoji });
      setRoom(toggled.state);
      void api.react({ messageId: rowId, emoji, active: toggled.active }).then(
        (count) =>
          setRoom((current) =>
            applyReaction(current, { messageId: rowId, emoji, count, mine: toggled.active })
          ),
        () => setRoom((current) => (current === toggled.state ? before : current))
      );
    },
    [api]
  );

  const pinMessage = useCallback(
    async (rowId: string) => {
      if (!api) return;
      const pin = await api.pin({ messageId: rowId, clientKey: randomUUID() });
      setRoom((current) => ({ ...current, pin }));
    },
    [api]
  );

  const unpin = useCallback(async () => {
    if (!api) return;
    await api.unpin();
    setRoom((current) => ({ ...current, pin: null }));
  }, [api]);

  const setLocked = useCallback(
    async (locked: boolean) => {
      if (!api) return;
      await api.setLocked(locked);
      setRoom((current) => ({ ...current, locked }));
    },
    [api]
  );

  const noteTypingHeartbeat = useCallback(() => {
    const now = Date.now();
    if (typingSentAt.current !== null && now - typingSentAt.current < TYPING_HEARTBEAT_MS) return;
    if (socketRef.current?.send({ type: "typing", active: true })) typingSentAt.current = now;
  }, []);

  const stopTyping = useCallback(() => {
    if (typingSentAt.current === null) return;
    typingSentAt.current = null;
    socketRef.current?.send({ type: "typing", active: false });
  }, []);

  const startReply = useCallback((rowId: string) => setReplyingTo(rowId), []);
  const cancelReply = useCallback(() => setReplyingTo(null), []);

  const setMemberMutedRemote = useCallback(
    async (chatParticipantId: string, muted: boolean) => {
      if (!api) return;
      await api.setMuted({ participantId: chatParticipantId, muted });
      setRoom((current) =>
        setMemberMuted(current, { participantId: chatParticipantId, muted, viewerId })
      );
    },
    [api, viewerId]
  );

  const deleteMessage = useCallback(
    async (rowId: string) => {
      if (!api) return;
      await api.deleteMessage(rowId).catch((error: unknown) => {
        safeLogWarn("[CalVideo] chat delete failed", { error: String(error) });
        throw error;
      });
      setRoom((current) => reduceDelete(current, { id: rowId, reason: "sender" }));
    },
    [api]
  );

  // --- View ----------------------------------------------------------------------------------
  const rows = useMemo<ChatRow[]>(() => {
    const stored = room.messages.map((message) => toRow(message, viewerId));
    const newestHeld = stored.at(-1)?.seq ?? 0;
    const pending = room.pending.map(
      (send): ChatRow => ({
        id: `pending:${send.clientKey}`,
        seq: newestHeld,
        senderId: viewerId,
        senderName: viewer?.displayName ?? "You",
        isLocal: true,
        isHost: viewer?.role === "host",
        text: send.body,
        at: Date.parse(send.createdAt) || Date.now(),
        status: send.status,
        deleted: false,
        kind: "text",
        reactions: [],
        replyTo: null,
      })
    );
    return [...stored, ...pending];
  }, [room.messages, room.pending, viewerId, viewer]);

  if (!api || !viewer || !ready) return null;
  const isHost = viewer.role === "host";
  const nameOf = (participantId: string) =>
    room.members.find((member) => member.participantId === participantId)?.displayName ?? null;
  const liveTypers = [...pruneTypers(typers, Date.now()).keys()].map(
    (id) => nameOf(id) ?? "Someone"
  );
  const newestOwn = [...room.messages]
    .reverse()
    .find((message) => message.speaker.participantId === viewerId);
  const seen = newestOwn ? seenByLabel({ seq: newestOwn.seq, receipts, viewerId, nameOf }) : null;
  const quoted = replyingTo
    ? room.messages.find((message) => message.id === replyingTo)
    : undefined;
  const unread = open
    ? 0
    : countCalChatUnread({ messages: room.messages, viewerId, lastSeenSeq, readSeq: room.readSeq });
  // Pending rows carry their clientKey, so a stored message's own id is never confused with one.
  const pendingIds = new Set(room.pending.map((send) => `pending:${send.clientKey}`));
  return {
    kind: "cal",
    rows,
    unread,
    connection,
    locked: room.locked,
    muted: room.muted,
    canModerate: isHost,
    hasOlder: room.hasOlder,
    pin: room.pin
      ? { messageId: room.pin.messageId, speakerName: room.pin.speakerName, body: room.pin.body }
      : null,
    capabilities: {
      react: true,
      pin: isHost,
      lock: isHost,
      deleteOwn: true,
      mute: isHost,
      reply: true,
    },
    typingLabel: typingLabel(liveTypers),
    seenBy: newestOwn && seen ? { rowId: newestOwn.id, label: seen } : null,
    replyingTo: quoted
      ? {
          rowId: quoted.id,
          senderName: quoted.speaker.displayName ?? "Guest",
          text: quoted.deletion ? "Message deleted" : quoted.body,
        }
      : null,
    mutedChatIds: isHost
      ? new Set(room.members.filter((member) => member.muted).map((member) => member.participantId))
      : undefined,
    maxBodyLength: CAL_CHAT_MAX_BODY,
    send,
    retry: (rowId) => {
      if (pendingIds.has(rowId)) retry(rowId);
    },
    markSeen,
    loadOlder,
    react,
    pinMessage: isHost ? pinMessage : undefined,
    unpin: isHost ? unpin : undefined,
    setLocked: isHost ? setLocked : undefined,
    deleteMessage,
    setMemberMuted: isHost ? setMemberMutedRemote : undefined,
    startReply,
    cancelReply,
    noteTyping: noteTypingHeartbeat,
    stopTyping,
  };
}
