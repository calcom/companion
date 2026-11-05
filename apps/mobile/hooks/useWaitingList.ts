import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  decideKnock,
  type RoomRef,
  readWaitingList,
  removeParticipant,
} from "@/services/cal-video/api";
import {
  reconcileWaitingList,
  restoreWaitingEntry,
  type WaitingEntry,
  waitingEntryKey,
} from "@/services/cal-video/waiting-list";
import { safeLogWarn } from "@/utils/safeLogger";

/** Someone may be at the door and a host is looking at the call, so it is worth checking often. */
const ACTIVE_POLL_MS = 5_000;

/**
 * The hosts' side of the lobby.
 *
 * Polled rather than pushed because nothing on the server holds a socket open. In the steady
 * state the poll is one indexed query that returns no rows. Paused while the app is in the
 * background: nobody is looking, and iOS would throttle the timer anyway.
 */
export function useWaitingList(input: {
  room: RoomRef;
  controlToken: string | null;
  enabled: boolean;
}): {
  entries: WaitingEntry[];
  /** The decision the server last refused to take, by `waitingEntryKey`, so the row can say so. */
  failed: ReadonlyMap<string, "admit" | "deny">;
  decide: (entry: WaitingEntry, decision: "admit" | "deny") => void;
  remove: (identityId: string) => Promise<void>;
} {
  const { room, controlToken, enabled } = input;
  const [entries, setEntries] = useState<WaitingEntry[]>([]);
  const [failed, setFailed] = useState<ReadonlyMap<string, "admit" | "deny">>(new Map());
  const shown = useRef<WaitingEntry[]>([]);
  const deciding = useRef(new Set<string>());
  useEffect(() => {
    shown.current = entries;
  }, [entries]);

  useEffect(() => {
    if (!enabled || !controlToken) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;

    const poll = async () => {
      if (cancelled || polling || AppState.currentState !== "active") return;
      polling = true;
      const decisions = new Set(deciding.current);
      const read = await readWaitingList(room, controlToken).catch(() => null);
      polling = false;
      if (cancelled) return;
      if (read) {
        const update = reconcileWaitingList({
          current: shown.current,
          incoming: read,
          deciding: decisions,
        });
        setEntries(update.entries);
        if (update.departed.length > 0) {
          const departed = new Set(update.departed.map(waitingEntryKey));
          setFailed((current) => withoutKeys(current, departed));
        }
      }
      timer = setTimeout(() => void poll(), ACTIVE_POLL_MS);
    };

    void poll();
    // Coming back to the front should not wait out a sleeping timer before showing the door.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      clearTimeout(timer);
      void poll();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, controlToken, room]);

  const decide = useCallback(
    (entry: WaitingEntry, decision: "admit" | "deny") => {
      if (!controlToken) return;
      const key = waitingEntryKey(entry);
      deciding.current.add(key);
      // Removed before the answer comes back: leaving the row invites a second tap on someone
      // who is by then already in the call.
      setEntries((current) => current.filter((candidate) => waitingEntryKey(candidate) !== key));
      setFailed((current) => withoutKeys(current, new Set([key])));
      void decideKnock(room, { controlToken, entry, decision }).then(
        () => deciding.current.delete(key),
        () => {
          deciding.current.delete(key);
          // The server declined to answer at all; the person is still at the door.
          setEntries((current) => restoreWaitingEntry(current, entry));
          setFailed((current) => new Map(current).set(key, decision));
        }
      );
    },
    [room, controlToken]
  );

  // No optimistic removal: the person leaves the roster when the driver says they are gone.
  const remove = useCallback(
    async (identityId: string) => {
      if (!controlToken) return;
      try {
        await removeParticipant(room, { controlToken, participantId: identityId });
      } catch (error) {
        safeLogWarn("[CalVideo] remove failed", { error: String(error) });
        throw error;
      }
    },
    [room, controlToken]
  );

  return { entries, failed, decide, remove };
}

function withoutKeys<T>(
  current: ReadonlyMap<string, T>,
  keys: ReadonlySet<string>
): ReadonlyMap<string, T> {
  if (![...keys].some((key) => current.has(key))) return current;
  const next = new Map(current);
  for (const key of keys) next.delete(key);
  return next;
}
