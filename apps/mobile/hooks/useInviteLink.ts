import { useCallback, useRef, useState } from "react";
import { Share } from "react-native";
import { mintInviteLink, type RoomRef } from "@/services/cal-video/api";
import { safeLogWarn } from "@/utils/safeLogger";

/**
 * Hands out a link that admits one person without knocking.
 *
 * Minted when first asked for and kept for the call: minting costs a signature and no storage,
 * and the share sheet needs the URL in hand when it opens.
 */
export function useInviteLink(input: { room: RoomRef; controlToken: string | null }): {
  share: () => Promise<void>;
  busy: boolean;
} {
  const { room, controlToken } = input;
  const link = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  const share = useCallback(async () => {
    if (!controlToken || busy) return;
    setBusy(true);
    const url = link.current
      ? link.current
      : await mintInviteLink(room, controlToken).catch((error: unknown) => {
          safeLogWarn("[CalVideo] invite failed", { error: String(error) });
          return null;
        });
    if (url === null) {
      setBusy(false);
      throw new Error("Could not create an invite link");
    }
    link.current = url;
    await Share.share({ url, message: url }).catch(() => undefined);
    setBusy(false);
  }, [room, controlToken, busy]);

  return { share, busy };
}
