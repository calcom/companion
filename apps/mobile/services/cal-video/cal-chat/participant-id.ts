import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server's derivation, given the hex SHA-256 of the salted video id. */
export function chatParticipantIdFromDigest(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The device's copy of the server's `toCalVideoChatParticipantId`: chat keys people by UUID, but a
 * recipient-bound invitee's video participant id is a short derived hash, so the People sheet
 * must convert before comparing or muting.
 */
export async function toCalChatParticipantId(videoParticipantId: string): Promise<string> {
  if (UUID_PATTERN.test(videoParticipantId)) return videoParticipantId.toLowerCase();
  const hex = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `cal-video-chat-participant:${videoParticipantId}`
  );
  return chatParticipantIdFromDigest(hex);
}
