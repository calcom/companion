import type { ReactionEmoji } from "./types";

/** A message as the chat sheet draws it, whichever chat it came from. */
export interface ChatRow {
  id: string;
  /** Arrival order; a send still in flight takes the newest seq provisionally. */
  seq: number;
  senderId: string | null;
  senderName: string;
  isLocal: boolean;
  isHost: boolean;
  text: string;
  /** Epoch ms. */
  at: number;
  status: "sent" | "sending" | "failed";
  /** The original text is never sent again once deleted; the row says so instead. */
  deleted: boolean;
  /** "pin"/"unpin" are the "{name} pinned a message" lines; `replyTo` quotes the message. */
  kind: "text" | "pin" | "unpin";
  reactions: { emoji: ReactionEmoji; count: number; mine: boolean }[];
  replyTo: { speakerName: string | null; excerpt: string; deleted: boolean } | null;
}

export type ChatConnection = "live" | "connecting" | "reconnecting" | "denied";

/**
 * One chat behind one panel: the provider's (RealtimeKit, Daily) or Cal Video's own durable one.
 * Optional members are present exactly when the matching capability is true, so the sheet offers
 * only what this chat can do.
 */
export interface ChatController {
  kind: "provider" | "cal";
  rows: ChatRow[];
  unread: number;
  connection: ChatConnection;
  /** A host turned chat off: everyone reads, nobody writes. */
  locked: boolean;
  /** The viewer was muted by a host: they read but cannot send or react. */
  muted: boolean;
  canModerate: boolean;
  hasOlder: boolean;
  pin: { messageId: string; speakerName: string | null; body: string } | null;
  capabilities: {
    react: boolean;
    pin: boolean;
    lock: boolean;
    deleteOwn: boolean;
    mute: boolean;
    reply: boolean;
  };
  /** Chat participant ids a host muted; present exactly when `capabilities.mute` is true. */
  mutedChatIds?: ReadonlySet<string>;
  /** Where the sender refuses longer messages outright. */
  maxBodyLength: number;
  /** "Ada is typing…", or `null`. Only a chat with presence ever sets it. */
  typingLabel: string | null;
  /** "Seen by Ada", under your newest message only; `null` where unknown or unread. */
  seenBy: { rowId: string; label: string } | null;
  /** The message a reply will quote, or `null`. */
  replyingTo: { rowId: string; senderName: string; text: string } | null;
  send: (text: string) => void;
  retry: (rowId: string) => void;
  /** The panel is open: everything shown now counts as seen. */
  markSeen: () => void;
  loadOlder?: () => void;
  react?: (rowId: string, emoji: ReactionEmoji) => void;
  pinMessage?: (rowId: string) => Promise<void>;
  unpin?: () => Promise<void>;
  setLocked?: (locked: boolean) => Promise<void>;
  deleteMessage?: (rowId: string) => Promise<void>;
  /** Mutes or unmutes one chat participant id. Present exactly when `capabilities.mute` is true. */
  setMemberMuted?: (chatParticipantId: string, muted: boolean) => Promise<void>;
  /** Present exactly when `capabilities.reply` is true. */
  startReply?: (rowId: string) => void;
  cancelReply?: () => void;
  /** Typing heartbeats, where the chat carries presence. */
  noteTyping?: () => void;
  stopTyping?: () => void;
}
