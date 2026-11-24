const { reconcileWaitingList, restoreWaitingEntry, waitingEntryKey } = require("./waiting-list");

const knock = (id, attempt = 1) => ({ id, attempt, displayName: `Guest ${id}` });

describe("waitingEntryKey", () => {
  test("distinguishes attempts of the same knock", () => {
    expect(waitingEntryKey(knock("a", 1))).not.toBe(waitingEntryKey(knock("a", 2)));
  });
});

describe("reconcileWaitingList", () => {
  test("reports arrivals and departures against what was shown", () => {
    const update = reconcileWaitingList({
      current: [knock("a"), knock("b")],
      incoming: [knock("b"), knock("c")],
      deciding: new Set(),
    });
    expect(update.entries.map((e) => e.id)).toEqual(["b", "c"]);
    expect(update.arrived.map((e) => e.id)).toEqual(["c"]);
    expect(update.departed.map((e) => e.id)).toEqual(["a"]);
  });

  test("does not bring back a knock with a decision in flight", () => {
    const update = reconcileWaitingList({
      current: [],
      incoming: [knock("a")],
      deciding: new Set([waitingEntryKey(knock("a"))]),
    });
    expect(update.entries).toEqual([]);
  });

  test("keeps a restored row whose decision is still in flight", () => {
    const update = reconcileWaitingList({
      current: [knock("a")],
      incoming: [knock("a")],
      deciding: new Set([waitingEntryKey(knock("a"))]),
    });
    expect(update.entries.map((e) => e.id)).toEqual(["a"]);
    expect(update.arrived).toEqual([]);
  });
});

describe("restoreWaitingEntry", () => {
  test("adds a refused decision back once", () => {
    const once = restoreWaitingEntry([], knock("a"));
    expect(restoreWaitingEntry(once, knock("a"))).toBe(once);
    expect(once).toHaveLength(1);
  });
});
