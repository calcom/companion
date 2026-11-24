const {
  appendChatMessage,
  CHAT_HISTORY_LIMIT,
  countUnreadMessages,
  outgoingChatText,
} = require("./chat-message");

const message = (id, overrides = {}) => ({
  id,
  senderId: "p1",
  senderName: "Ada",
  isLocal: false,
  text: `m${id}`,
  at: Number(id),
  ...overrides,
});

describe("appendChatMessage", () => {
  test("appends in arrival order and returns a new array", () => {
    const before = [message("1")];
    const after = appendChatMessage(before, message("2"));
    expect(after.map((m) => m.id)).toEqual(["1", "2"]);
    expect(after).not.toBe(before);
  });

  test("drops the oldest past the history limit", () => {
    let messages = [];
    for (let i = 0; i < CHAT_HISTORY_LIMIT + 3; i++)
      messages = appendChatMessage(messages, message(String(i)));
    expect(messages).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(messages[0].id).toBe("3");
  });
});

describe("outgoingChatText", () => {
  test("trims and returns the body", () => {
    expect(outgoingChatText("  hello  ")).toBe("hello");
  });

  test("rejects an empty message instead of sending nothing", () => {
    expect(() => outgoingChatText("   ")).toThrow(/cannot be empty/);
  });

  test("rejects an over-length message instead of cutting it short", () => {
    expect(() => outgoingChatText("x".repeat(1001))).toThrow(/cannot exceed/);
  });
});

describe("countUnreadMessages", () => {
  test("counts only others' messages newer than the last seen moment", () => {
    const messages = [
      message("1", { at: 10 }),
      message("2", { at: 20, isLocal: true }),
      message("3", { at: 30 }),
      message("4", { at: 40 }),
    ];
    expect(countUnreadMessages({ messages, lastSeenAt: 25 })).toBe(2);
    expect(countUnreadMessages({ messages, lastSeenAt: 40 })).toBe(0);
  });
});
