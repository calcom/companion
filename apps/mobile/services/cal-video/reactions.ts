import type { Reaction, ReactionEmoji } from "./types";

export const REACTION_FLUSH_MS = 250;

export function queueReaction(
  pending: readonly { emoji: ReactionEmoji; count: number }[],
  emoji: ReactionEmoji
): { emoji: ReactionEmoji; count: number }[] {
  const last = pending.at(-1);
  if (last?.emoji === emoji && last.count < 20) {
    return [...pending.slice(0, -1), { emoji, count: last.count + 1 }];
  }
  return [...pending, { emoji, count: 1 }];
}

/** A badge goes this long after the last reaction in its run. */
export const REACTION_BADGE_MS = 4_000;
/** Another reaction with the same emoji within this long of the last one extends the run. */
const REACTION_RUN_WINDOW_MS = 3_000;
/**
 * What a reactor's badge shows: their latest reaction and how many sends of that emoji the
 * current run has reached. `key` is the id of the reaction that started the run, so a badge pops
 * in for a new run or a new emoji and only updates its number within one.
 */
export interface ReactionBadge {
  key: string;
  emoji: Reaction["emoji"];
  count: number;
  at: number;
}

/** The badge per participant, from reactions oldest first, with expired runs left out. */
export function reactionBadges(
  reactions: readonly Reaction[],
  now: number
): ReadonlyMap<string, ReactionBadge> {
  const badges = new Map<string, ReactionBadge>();
  for (const reaction of reactions) {
    const run = badges.get(reaction.participantId);
    const continues =
      run !== undefined &&
      run.emoji === reaction.emoji &&
      reaction.at - run.at <= REACTION_RUN_WINDOW_MS;
    badges.set(
      reaction.participantId,
      continues
        ? { key: run.key, emoji: run.emoji, count: run.count + reaction.count, at: reaction.at }
        : { key: reaction.id, emoji: reaction.emoji, count: reaction.count, at: reaction.at }
    );
  }
  for (const [id, badge] of badges) {
    if (badge.at + REACTION_BADGE_MS <= now) badges.delete(id);
  }
  return badges;
}

/** When the next badge goes out, so one timer serves them all; `null` with none showing. */
export function nextBadgeExpiry(badges: ReadonlyMap<string, ReactionBadge>): number | null {
  let earliest: number | null = null;
  for (const badge of badges.values()) {
    const expiry = badge.at + REACTION_BADGE_MS;
    if (earliest === null || expiry < earliest) earliest = expiry;
  }
  return earliest;
}

/** How long a float takes to rise and fade; a float is retired after this. */
export const REACTION_FLOAT_MS = 3_000;
const MAX_FLOATS = 6;

/**
 * One reaction rising from the bottom right: where it starts, how far it sways and leans, and how
 * far it climbs, so rapid repeats spread out instead of stacking on one spot.
 */
export interface ReactionFloat {
  id: string;
  participantId: string;
  emoji: Reaction["emoji"];
  startedAt: number;
  offsetPx: number;
  swayPx: number;
  tiltDeg: number;
  riseScale: number;
}

const between = (random: () => number, min: number, max: number) => min + random() * (max - min);

/**
 * Adds a float for each reaction after `lastSeenId` that is still young enough to rise, up to the
 * cap. The age guard stops a mount, or a buffer the last-seen id rolled out of, replaying old ones.
 */
export function admitReactionFloats(input: {
  active: readonly ReactionFloat[];
  reactions: readonly Reaction[];
  lastSeenId: string | null;
  now: number;
  random?: () => number;
}): ReactionFloat[] {
  const { active, reactions, lastSeenId, now, random = Math.random } = input;
  const seen = lastSeenId === null ? -1 : reactions.findLastIndex((r) => r.id === lastSeenId);
  const next = active.filter((float) => float.startedAt + REACTION_FLOAT_MS > now);
  for (const reaction of reactions.slice(seen + 1)) {
    if (next.length >= MAX_FLOATS) break;
    if (reaction.at <= now - REACTION_FLOAT_MS) continue;
    next.push({
      id: reaction.id,
      participantId: reaction.participantId,
      emoji: reaction.emoji,
      startedAt: now,
      offsetPx: between(random, -48, 0),
      swayPx: (random() < 0.5 ? -1 : 1) * between(random, 6, 14),
      tiltDeg: between(random, -25, 25),
      riseScale: between(random, 0.85, 1.15),
    });
  }
  return next;
}
