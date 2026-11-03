import type { Reaction } from "./types";

/** A badge goes this long after the last reaction in its run. */
export const REACTION_BADGE_MS = 4_000;
/** Another reaction with the same emoji within this long of the last one extends the run. */
const REACTION_RUN_WINDOW_MS = 3_000;
/** Reactions kept in call state; older ones can no longer show on anything. */
const REACTION_BUFFER = 60;

/** Each arrival appends; anything too old to badge is dropped so the list stays small. */
export function appendReaction(
  reactions: readonly Reaction[],
  reaction: Reaction,
  now: number = reaction.at
): Reaction[] {
  const fresh = reactions.filter((r) => r.at + REACTION_BADGE_MS > now);
  const next = [...fresh, reaction];
  return next.length > REACTION_BUFFER ? next.slice(next.length - REACTION_BUFFER) : next;
}

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
