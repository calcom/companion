import { isReactionEmoji, type ReactionEmoji } from "./types";

/**
 * Hands and reactions over RealtimeKit's broadcast channel.
 *
 * The SDK delivers a broadcast with no sender, so every message names its sender itself and the
 * receiver only honours a name it can see in the room. That is the trust level of the room: a
 * participant could raise another's hand, which costs no more than saying it out loud. Payloads
 * are flat (string | number | boolean) because that is all the channel carries.
 */
export const RTK_SIGNAL_TYPE = "cal-video";
const VERSION = 1;

/** The receiver's clamp on coalesced reaction sends, matching the web. */
export const REACTION_COUNT_MAX = 20;

export type RtkSignal =
  | { kind: "hand"; from: string; raisedAt: number | null }
  | { kind: "reaction"; from: string; emoji: ReactionEmoji; count: number }
  /** A host lowers one hand or every hand. */
  | { kind: "lower-hand"; from: string; target: string | "all" }
  /** A newcomer asks everyone to restate what the channel does not persist: raised hands. */
  | { kind: "sync"; from: string };

export type RtkSignalPayload = Record<string, string | number | boolean>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A signal before the driver stamps its own peer id on it. */
export type OutgoingSignal = DistributiveOmit<RtkSignal, "from">;

export function encodeSignal(signal: RtkSignal): RtkSignalPayload {
  switch (signal.kind) {
    case "hand":
      return { v: VERSION, kind: "hand", from: signal.from, raisedAt: signal.raisedAt ?? 0 };
    case "reaction":
      return {
        v: VERSION,
        kind: "reaction",
        from: signal.from,
        emoji: signal.emoji,
        count: signal.count,
      };
    case "lower-hand":
      return { v: VERSION, kind: "lower-hand", from: signal.from, target: signal.target };
    case "sync":
      return { v: VERSION, kind: "sync", from: signal.from };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

/**
 * The signal a broadcast carries, or `null` for anything else on the channel, anything from a
 * sender not in `knownIds`, or anything malformed. Unknown kinds and versions are ignored rather
 * than failed, so an older app in the room keeps working beside a newer one.
 */
export function decodeSignal(input: {
  type: string;
  payload: unknown;
  knownIds: ReadonlySet<string>;
}): RtkSignal | null {
  if (input.type !== RTK_SIGNAL_TYPE) return null;
  const payload = input.payload;
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record.v !== VERSION) return null;
  const from = text(record.from);
  if (from === null || !input.knownIds.has(from)) return null;

  switch (record.kind) {
    case "hand": {
      const raisedAt = record.raisedAt;
      if (typeof raisedAt !== "number" || !Number.isFinite(raisedAt) || raisedAt < 0) return null;
      return { kind: "hand", from, raisedAt: raisedAt === 0 ? null : raisedAt };
    }
    case "reaction": {
      const emoji = text(record.emoji);
      if (emoji === null || !isReactionEmoji(emoji)) return null;
      const raw = record.count;
      const count =
        typeof raw === "number" && Number.isInteger(raw) && raw > 0
          ? Math.min(raw, REACTION_COUNT_MAX)
          : 1;
      return { kind: "reaction", from, emoji, count };
    }
    case "lower-hand": {
      const target = text(record.target);
      if (target === null) return null;
      return { kind: "lower-hand", from, target };
    }
    case "sync":
      return { kind: "sync", from };
    default:
      return null;
  }
}
