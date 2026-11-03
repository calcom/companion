const {
  appendReaction,
  nextBadgeExpiry,
  REACTION_BADGE_MS,
  reactionBadges,
} = require("./reactions");

const reaction = (id, participantId, emoji, at, count = 1) => ({
  id,
  participantId,
  emoji,
  count,
  at,
});

describe("appendReaction", () => {
  test("appends and drops what can no longer show", () => {
    let list = appendReaction([], reaction("1", "a", "👍", 0));
    list = appendReaction(list, reaction("2", "b", "❤️", 1000));
    expect(list.map((r) => r.id)).toEqual(["1", "2"]);
    list = appendReaction(list, reaction("3", "a", "👍", REACTION_BADGE_MS + 1));
    expect(list.map((r) => r.id)).toEqual(["2", "3"]);
  });
});

describe("reactionBadges", () => {
  test("a run of one emoji counts up; a new emoji restarts the badge", () => {
    const badges = reactionBadges(
      [
        reaction("1", "a", "👍", 0),
        reaction("2", "a", "👍", 1000, 2),
        reaction("3", "a", "❤️", 1500),
        reaction("4", "b", "🎉", 2000),
      ],
      2000
    );
    expect(badges.get("a")).toEqual({ key: "3", emoji: "❤️", count: 1, at: 1500 });
    expect(badges.get("b")).toEqual({ key: "4", emoji: "🎉", count: 1, at: 2000 });
    expect(
      reactionBadges([reaction("1", "a", "👍", 0), reaction("2", "a", "👍", 1000, 2)], 1000).get(
        "a"
      )
    ).toEqual({ key: "1", emoji: "👍", count: 3, at: 1000 });
  });

  test("the same emoji after a pause is a new run, and old badges expire", () => {
    const badges = reactionBadges(
      [reaction("1", "a", "👍", 0), reaction("2", "a", "👍", 5000)],
      5000
    );
    expect(badges.get("a")).toEqual({ key: "2", emoji: "👍", count: 1, at: 5000 });
    expect(reactionBadges([reaction("1", "a", "👍", 0)], REACTION_BADGE_MS).size).toBe(0);
  });

  test("nextBadgeExpiry is the earliest badge's end", () => {
    const badges = reactionBadges(
      [reaction("1", "a", "👍", 0), reaction("2", "b", "👍", 500)],
      600
    );
    expect(nextBadgeExpiry(badges)).toBe(REACTION_BADGE_MS);
    expect(nextBadgeExpiry(new Map())).toBeNull();
  });
});
