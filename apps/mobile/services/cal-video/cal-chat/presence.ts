/** While the viewer types, at most one typing frame per interval; the gateway budgets around this. */
export const TYPING_HEARTBEAT_MS = 2_500;
/** A typer whose heartbeats stop is dropped after this, so a lost stop frame cannot leave one behind. */
export const TYPER_EXPIRY_MS = 4_000;

/** Who is typing, by chat participant id, and when each entry expires. */
export type Typers = ReadonlyMap<string, number>;

export function noteTyping(
  typers: Typers,
  input: { participantId: string; active: boolean; now: number }
): Typers {
  const next = new Map(typers);
  if (input.active) next.set(input.participantId, input.now + TYPER_EXPIRY_MS);
  else next.delete(input.participantId);
  return next;
}

export function pruneTypers(typers: Typers, now: number): Typers {
  if (![...typers.values()].some((expiresAt) => expiresAt <= now)) return typers;
  return new Map([...typers].filter(([, expiresAt]) => expiresAt > now));
}

/** "Ada is typing…", "Ada and Bob are typing…", "3 people are typing…". */
export function typingLabel(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

/** Each member's cumulative read watermark, by chat participant id. */
export type ReadReceipts = ReadonlyMap<string, number>;

export function advanceReceipts(
  receipts: ReadReceipts,
  updates: readonly { participantId: string; readSeq: number }[]
): ReadReceipts {
  let next: Map<string, number> | null = null;
  for (const update of updates) {
    if ((receipts.get(update.participantId) ?? 0) >= update.readSeq) continue;
    next ??= new Map(receipts);
    next.set(update.participantId, update.readSeq);
  }
  return next ?? receipts;
}

/**
 * Who has read a message of yours: everyone else whose watermark reaches its seq. The label is
 * drawn under your newest message only, as chat apps do.
 */
export function seenByLabel(input: {
  seq: number;
  receipts: ReadReceipts;
  viewerId: string | null;
  nameOf: (participantId: string) => string | null;
}): string | null {
  const readers = [...input.receipts]
    .filter(([id, readSeq]) => id !== input.viewerId && readSeq >= input.seq)
    .map(([id]) => input.nameOf(id) ?? "Guest");
  if (readers.length === 0) return null;
  if (readers.length <= 2) return `Seen by ${readers.join(" and ")}`;
  return `Seen by ${readers.length}`;
}
