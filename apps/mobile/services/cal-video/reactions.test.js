const { nextBadgeExpiry, REACTION_BADGE_MS, reactionBadges } = require("./reactions");

const reaction = (id, participantId, emoji, at, count = 1) => ({
  id,
  participantId,
  emoji,
  count,
  at,
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

describe("admitReactionFloats", () => {
  const { admitReactionFloats, REACTION_FLOAT_MS } = require("./reactions");
  const random = () => 0.5;

  test("floats only reactions after the last one seen that are still fresh", () => {
    const reactions = [
      reaction("old", "a", "👍", 0),
      reaction("seen", "a", "👍", 9000),
      reaction("new", "b", "🎉", 9500),
    ];
    const floats = admitReactionFloats({
      active: [],
      reactions,
      lastSeenId: "seen",
      now: 10_000,
      random,
    });
    expect(floats.map((float) => float.id)).toEqual(["new"]);
    expect(
      admitReactionFloats({ active: [], reactions, lastSeenId: null, now: 10_000, random }).map(
        (float) => float.id
      )
    ).toEqual(["seen", "new"]);
  });

  test("retires finished floats and caps how many rise at once", () => {
    const burst = Array.from({ length: 10 }, (_, i) => reaction(`${i}`, "a", "❤️", 0));
    const floats = admitReactionFloats({
      active: [],
      reactions: burst,
      lastSeenId: null,
      now: 0,
      random,
    });
    expect(floats).toHaveLength(6);
    expect(
      admitReactionFloats({
        active: floats,
        reactions: burst,
        lastSeenId: "9",
        now: REACTION_FLOAT_MS,
      })
    ).toEqual([]);
  });
});
