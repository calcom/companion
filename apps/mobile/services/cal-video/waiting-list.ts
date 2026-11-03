/** One knock attempt. A re-knock after a deny or expiry is the same `id` with a higher `attempt`. */
export type WaitingEntry = { id: string; attempt: number; displayName: string };

/**
 * `arrived` is what this read added and `departed` what it removed, so a caller can announce each
 * person once and take the announcement back when they are no longer at the door.
 */
export type WaitingListUpdate = {
  entries: WaitingEntry[];
  arrived: WaitingEntry[];
  departed: WaitingEntry[];
};

export function waitingEntryKey(entry: Pick<WaitingEntry, "id" | "attempt">): string {
  return `${entry.id}:${entry.attempt}`;
}

/**
 * Folds one lobby read, which lists everyone still waiting oldest first, into the list a host sees.
 *
 * A knock with a decision in flight is not brought back by a read that raced the decision. If the
 * decision failed and the row was restored meanwhile, it stays.
 */
export function reconcileWaitingList(input: {
  current: WaitingEntry[];
  incoming: WaitingEntry[];
  deciding: ReadonlySet<string>;
}): WaitingListUpdate {
  const shown = new Set(input.current.map(waitingEntryKey));
  const entries = input.incoming.filter((knock) => {
    const key = waitingEntryKey(knock);
    return !input.deciding.has(key) || shown.has(key);
  });
  const remaining = new Set(entries.map(waitingEntryKey));
  return {
    entries,
    arrived: entries.filter((entry) => !shown.has(waitingEntryKey(entry))),
    departed: input.current.filter((entry) => !remaining.has(waitingEntryKey(entry))),
  };
}

/**
 * Puts a knock back after a decision the server refused to take. Idempotent, because a poll may
 * have re-read the same knock in the meantime; the next read restores the oldest-first order.
 */
export function restoreWaitingEntry(current: WaitingEntry[], entry: WaitingEntry): WaitingEntry[] {
  const key = waitingEntryKey(entry);
  if (current.some((candidate) => waitingEntryKey(candidate) === key)) return current;
  return [...current, entry];
}
