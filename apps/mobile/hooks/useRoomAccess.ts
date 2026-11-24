import { useCallback, useState } from "react";
import { type RoomRef, setRequireApproval } from "@/services/cal-video/api";

/**
 * The host's switch between a knocking room and one anyone with the link can walk into.
 *
 * Applied only once the server has said so: a switch that flipped on the tap and quietly flipped
 * back on a 429 would show a host "open" while people were still knocking. The app has no page
 * load to learn the room's current mode from, so it starts unknown and shows both options
 * unselected until the host chooses one.
 */
export function useRoomAccess(input: { room: RoomRef; controlToken: string | null }): {
  requireApproval: boolean | null;
  pending: boolean;
  failed: boolean;
  set: (requireApproval: boolean) => void;
} {
  const { room, controlToken } = input;
  const [requireApproval, setMode] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = useCallback(
    (next: boolean) => {
      if (!controlToken) return;
      setPending(true);
      setFailed(false);
      setRequireApproval(room, { controlToken, requireApproval: next }).then(
        (confirmed) => {
          setMode(confirmed);
          setPending(false);
        },
        () => {
          setFailed(true);
          setPending(false);
        }
      );
    },
    [room, controlToken]
  );

  return { requireApproval, pending, failed, set };
}
