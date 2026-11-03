const {
  decodeSignal,
  encodeSignal,
  REACTION_COUNT_MAX,
  RTK_SIGNAL_TYPE,
} = require("./rtk-signals");

const knownIds = new Set(["a", "b"]);
const decode = (payload, type = RTK_SIGNAL_TYPE) => decodeSignal({ type, payload, knownIds });

describe("rtk signals", () => {
  test("round-trips each kind through a flat payload", () => {
    const signals = [
      { kind: "hand", from: "a", raisedAt: 1700 },
      { kind: "hand", from: "a", raisedAt: null },
      { kind: "reaction", from: "b", emoji: "👍", count: 3 },
      { kind: "lower-hand", from: "a", target: "b" },
      { kind: "lower-hand", from: "a", target: "all" },
      { kind: "sync", from: "b" },
    ];
    for (const signal of signals) {
      const payload = encodeSignal(signal);
      for (const value of Object.values(payload)) {
        expect(["string", "number", "boolean"]).toContain(typeof value);
      }
      expect(decode(payload)).toEqual(signal);
    }
  });

  test("ignores other channels, other versions, unknown kinds and strangers", () => {
    expect(decode(encodeSignal({ kind: "sync", from: "a" }), "chat")).toBeNull();
    expect(decode({ v: 2, kind: "sync", from: "a" })).toBeNull();
    expect(decode({ v: 1, kind: "wave", from: "a" })).toBeNull();
    expect(decode({ v: 1, kind: "sync", from: "zed" })).toBeNull();
    expect(decode({ v: 1, kind: "sync" })).toBeNull();
    expect(decode(null)).toBeNull();
    expect(decode("sync")).toBeNull();
  });

  test("rejects malformed fields and clamps reaction counts", () => {
    expect(decode({ v: 1, kind: "hand", from: "a", raisedAt: "now" })).toBeNull();
    expect(decode({ v: 1, kind: "hand", from: "a", raisedAt: -1 })).toBeNull();
    expect(decode({ v: 1, kind: "reaction", from: "a", emoji: "🦄" })).toBeNull();
    expect(decode({ v: 1, kind: "reaction", from: "a", emoji: "❤️" })).toEqual({
      kind: "reaction",
      from: "a",
      emoji: "❤️",
      count: 1,
    });
    expect(decode({ v: 1, kind: "reaction", from: "a", emoji: "❤️", count: 999 }).count).toBe(
      REACTION_COUNT_MAX
    );
    expect(decode({ v: 1, kind: "reaction", from: "a", emoji: "❤️", count: 1.5 }).count).toBe(1);
    expect(decode({ v: 1, kind: "lower-hand", from: "a", target: "" })).toBeNull();
  });
});
