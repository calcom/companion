const {
  advanceReceipts,
  noteTyping,
  pruneTypers,
  seenByLabel,
  TYPER_EXPIRY_MS,
  typingLabel,
} = require("./presence");

describe("typers", () => {
  test("a heartbeat adds a typer, a stop removes them, silence expires them", () => {
    let typers = noteTyping(new Map(), { participantId: "a", active: true, now: 0 });
    typers = noteTyping(typers, { participantId: "b", active: true, now: 1000 });
    expect([...typers.keys()]).toEqual(["a", "b"]);
    typers = noteTyping(typers, { participantId: "b", active: false, now: 1500 });
    expect([...typers.keys()]).toEqual(["a"]);
    expect(pruneTypers(typers, TYPER_EXPIRY_MS - 1)).toBe(typers);
    expect([...pruneTypers(typers, TYPER_EXPIRY_MS).keys()]).toEqual([]);
  });

  test("typingLabel reads naturally", () => {
    expect(typingLabel([])).toBeNull();
    expect(typingLabel(["Ada"])).toBe("Ada is typing…");
    expect(typingLabel(["Ada", "Bob"])).toBe("Ada and Bob are typing…");
    expect(typingLabel(["Ada", "Bob", "Cy"])).toBe("3 people are typing…");
  });
});

describe("receipts", () => {
  test("watermarks only move forward", () => {
    const first = advanceReceipts(new Map(), [{ participantId: "a", readSeq: 5 }]);
    expect(advanceReceipts(first, [{ participantId: "a", readSeq: 3 }])).toBe(first);
    expect(advanceReceipts(first, [{ participantId: "a", readSeq: 7 }]).get("a")).toBe(7);
  });

  test("seenByLabel names up to two readers, excluding the viewer", () => {
    const receipts = new Map([
      ["me", 9],
      ["a", 9],
      ["b", 4],
    ]);
    const nameOf = (id) => ({ a: "Ada", b: "Bob", c: "Cy" })[id] ?? null;
    expect(seenByLabel({ seq: 5, receipts, viewerId: "me", nameOf })).toBe("Seen by Ada");
    expect(seenByLabel({ seq: 3, receipts, viewerId: "me", nameOf })).toBe("Seen by Ada and Bob");
    expect(seenByLabel({ seq: 10, receipts, viewerId: "me", nameOf })).toBeNull();
    const many = new Map([
      ["a", 1],
      ["b", 1],
      ["c", 1],
    ]);
    expect(seenByLabel({ seq: 1, receipts: many, viewerId: "me", nameOf })).toBe("Seen by 3");
  });
});
