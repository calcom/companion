/**
 * Cal Video's own durable chat, as the room's server speaks it. Participants are opaque UUID
 * strings, never Cal.com user ids. Mirrors `apps/video/modules/room/chat/cal-video-chat-types.ts`.
 */
import { z } from "zod";
import { REACTION_EMOJIS } from "../types";

export type CalChatRole = "host" | "guest";
export type CalChatDeletionReason = "sender" | "moderator";

const reactionEmojiSchema = z.enum(REACTION_EMOJIS);
export type CalChatReactionEmoji = z.infer<typeof reactionEmojiSchema>;

export const calChatParticipantSchema = z.object({
  participantId: z.string(),
  displayName: z.string().nullable(),
  isHost: z.boolean(),
  role: z.enum(["host", "guest"]),
  muted: z.boolean().optional(),
});
export type CalChatParticipant = z.infer<typeof calChatParticipantSchema>;

const reactionSchema = z.object({
  emoji: reactionEmojiSchema,
  count: z.number().int(),
  mine: z.boolean(),
});
export type CalChatReaction = z.infer<typeof reactionSchema>;

const replySchema = z.object({
  id: z.string(),
  seq: z.number().int(),
  speakerName: z.string().nullable(),
  excerpt: z.string(),
  deleted: z.boolean(),
});
export type CalChatReply = z.infer<typeof replySchema>;

export const calChatMessageSchema = z.object({
  id: z.string(),
  seq: z.number().int(),
  body: z.string(),
  clientKey: z.string(),
  createdAt: z.string(),
  speaker: calChatParticipantSchema,
  replyTo: replySchema.nullable().optional(),
  deletion: z
    .object({ reason: z.enum(["sender", "moderator"]) })
    .nullable()
    .optional(),
  reactions: z.array(reactionSchema).optional(),
  /** "pin"/"unpin" are the "{name} pinned a message" rows. Absent means text. */
  kind: z.enum(["text", "pin", "unpin"]).optional(),
});
export type CalChatMessage = z.infer<typeof calChatMessageSchema>;

export const calChatPinSchema = z.object({
  messageId: z.string(),
  seq: z.number().int(),
  speakerName: z.string().nullable(),
  body: z.string(),
  pinnedByName: z.string().nullable(),
  pinnedAt: z.string(),
});
export type CalChatPin = z.infer<typeof calChatPinSchema>;

const receiptSchema = z.object({
  participantId: z.string().optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  deliveredSeq: z.number().int(),
  readSeq: z.number().int(),
});

/** Who a participant frame is about: frames the shared gateway builds say `userId`, Cal Video's say both. */
const subjectSchema = z.object({
  participantId: z.string().optional(),
  userId: z.union([z.string(), z.number()]).optional(),
});

export const calChatServerFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("message"), message: calChatMessageSchema }),
  z.object({
    type: z.literal("message.deleted"),
    id: z.string(),
    reason: z.enum(["sender", "moderator"]),
  }),
  z.object({
    type: z.literal("reaction"),
    messageId: z.string(),
    emoji: reactionEmojiSchema,
    count: z.number().int(),
    participantId: z.string().optional(),
    userId: z.union([z.string(), z.number()]).optional(),
    active: z.boolean().optional(),
  }),
  z.object({ type: z.literal("pin"), pin: calChatPinSchema.nullable() }),
  z.object({ type: z.literal("locked"), locked: z.boolean() }),
  subjectSchema.extend({ type: z.literal("member.muted"), muted: z.boolean() }),
  subjectSchema.extend({ type: z.literal("member.removed"), banned: z.boolean() }),
  z.object({ type: z.literal("member.joined"), member: calChatParticipantSchema }),
  subjectSchema.extend({ type: z.literal("member.left") }),
  subjectSchema.extend({ type: z.literal("typing"), active: z.boolean() }),
  z.object({ type: z.literal("receipts"), receipts: z.array(receiptSchema) }),
  z.object({ type: z.literal("reconnect") }),
  z.object({ type: z.literal("denied") }),
]);
export type CalChatServerFrame = z.infer<typeof calChatServerFrameSchema>;

export type CalChatClientFrame =
  | { type: "auth"; token: string }
  | { type: "ping" }
  | { type: "typing"; active: boolean }
  | { type: "ack"; deliveredSeq: number; readSeq: number };

/** WebSocket close code for an auth or membership denial. */
export const CAL_CHAT_DENIED_CLOSE_CODE = 4403;
/** WebSocket close code for a connection retired before its function instance's max duration. */
export const CAL_CHAT_ROTATE_CLOSE_CODE = 4000;

/** The subject of a participant frame, whichever field names it. */
export function frameSubject(frame: {
  participantId?: string;
  userId?: string | number;
}): string | null {
  if (frame.participantId) return frame.participantId;
  if (frame.userId !== undefined) return String(frame.userId);
  return null;
}

export function parseCalChatServerFrame(raw: string): CalChatServerFrame | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = calChatServerFrameSchema.safeParse(json);
  return result.success ? result.data : null;
}
