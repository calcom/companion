import { useEffect, useState } from "react";
import { toCalChatParticipantId } from "@/services/cal-video/cal-chat/participant-id";

/**
 * The video identities among `identityIds` whose chat identity a host has muted. The People sheet
 * keys people by video identity and the chat by its own UUID, so the two are mapped here. `null`
 * where durable chat is off or this viewer may not mute.
 */
export function useChatMutedIds(input: {
  identityIds: readonly string[];
  mutedChatIds: ReadonlySet<string> | null;
}): ReadonlySet<string> | null {
  const [muted, setMuted] = useState<ReadonlySet<string> | null>(null);
  // Both inputs are rebuilt every render, so the effect keys on their contents.
  const identityKey = input.identityIds.join("\n");
  const mutedKey = input.mutedChatIds ? [...input.mutedChatIds].sort().join("\n") : null;
  useEffect(() => {
    if (mutedKey === null) {
      setMuted(null);
      return;
    }
    const identityIds = identityKey ? identityKey.split("\n") : [];
    const mutedChatIds = new Set(mutedKey ? mutedKey.split("\n") : []);
    let current = true;
    void Promise.all(identityIds.map((id) => toCalChatParticipantId(id))).then((chatIds) => {
      if (!current) return;
      setMuted(new Set(identityIds.filter((_, index) => mutedChatIds.has(chatIds[index]))));
    });
    return () => {
      current = false;
    };
  }, [identityKey, mutedKey]);
  return input.mutedChatIds ? muted : null;
}
