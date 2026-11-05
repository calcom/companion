import { z } from "zod";
import type { JoinGrant } from "./types";

/**
 * A grant arrives as JSON, so the compile-time correlation in `JoinGrant` proves nothing at
 * runtime. Mirrors the web app's `join-grant-schema`. Not `.strict()`: a grant from a newer
 * deploy may carry a field this build has not learned about yet.
 */
const videoProviderSchema = z.union([z.literal("daily"), z.literal("realtimekit")]);

const grantedCapabilitiesSchema = z.object({
  canRecord: z.boolean(),
  canTranscribe: z.boolean(),
  canScreenShare: z.boolean(),
  canPublishVideo: z.boolean(),
  canChat: z.boolean(),
  canAdmit: z.boolean(),
  canEndForEveryone: z.boolean(),
  canRemoveParticipant: z.boolean(),
  maxParticipants: z.number().int().positive(),
});

const joinGrantCommonShape = {
  sessionId: z.string().min(1),
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  role: z.union([z.literal("host"), z.literal("participant")]),
  capabilities: grantedCapabilitiesSchema,
  expiresAt: z.number().int(),
  sessionEndsAt: z.number().int(),
  controlToken: z.string().min(1),
  chat: z.union([z.literal("provider"), z.literal("cal")]).optional(),
};

const sfuJoinGrantSchema = z.discriminatedUnion("provider", [
  z.object({
    ...joinGrantCommonShape,
    transport: z.literal("sfu"),
    provider: z.literal("daily"),
    session: z.object({ roomUrl: z.string().url(), meetingToken: z.string().min(1) }),
  }),
  z.object({
    ...joinGrantCommonShape,
    transport: z.literal("sfu"),
    provider: z.literal("realtimekit"),
    session: z.object({
      baseUrl: z.string().url(),
      meetingId: z.string().min(1),
      authToken: z.string().min(1),
      hostPresetName: z.string().min(1),
      videoQuality: z.enum(["qvga", "vga", "hd", "fhd", "uhd"]).optional(),
    }),
  }),
]);

const loopbackJoinGrantSchema = z.object({
  ...joinGrantCommonShape,
  transport: z.literal("loopback"),
  provider: z.undefined().optional(),
  session: z.undefined().optional(),
});

export const joinGrantSchema = z.union([
  sfuJoinGrantSchema,
  loopbackJoinGrantSchema,
]) satisfies z.ZodType<JoinGrant>;

export { videoProviderSchema };
