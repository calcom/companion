const {
  addPending,
  applyReaction,
  countCalChatUnread,
  deleteMessage,
  EMPTY_CAL_CHAT,
  firstGapAfter,
  memberJoined,
  memberLeft,
  mergeMessages,
  newestSeq,
  setMemberMuted,
  toggleOwnReaction,
} = require("./reducer");

const speaker = (participantId, isHost = false) => ({
  participantId,
  displayName: participantId,
  isHost,
  role: isHost ? "host" : "guest",
});

const message = (seq, overrides = {}) => ({
  id: `m${seq}`,
  seq,
  body: `body ${seq}`,
  clientKey: `k${seq}`,
  createdAt: new Date(seq * 1000).toISOString(),
  speaker: speaker("a"),
  ...overrides,
});

describe("mergeMessages", () => {
  test("orders by seq, replaces held rows and clears the pending send they confirm", () => {
    let state = addPending(EMPTY_CAL_CHAT, { clientKey: "k2", body: "body 2", createdAt: "x" });
    state = mergeMessages(state, [message(3), message(1)]);
    state = mergeMessages(state, [message(2), { ...message(3), body: "edited" }]);
    expect(state.messages.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(state.messages[2].body).toBe("edited");
    expect(state.pending).toEqual([]);
  });

  test("a live frame without reactions keeps the reactions a history read gave", () => {
    const withReactions = message(1, { reactions: [{ emoji: "👍", count: 2, mine: false }] });
    let state = mergeMessages(EMPTY_CAL_CHAT, [withReactions]);
    state = mergeMessages(state, [message(1)]);
    expect(state.messages[0].reactions).toEqual([{ emoji: "👍", count: 2, mine: false }]);
  });
});

describe("deleteMessage", () => {
  test("blanks the body, drops reactions and unpins the message", () => {
    let state = mergeMessages(EMPTY_CAL_CHAT, [
      message(1, { reactions: [{ emoji: "❤️", count: 1, mine: true }] }),
    ]);
    state = {
      ...state,
      pin: {
        messageId: "m1",
        seq: 1,
        speakerName: "a",
        body: "body 1",
        pinnedByName: null,
        pinnedAt: "x",
      },
    };
    state = deleteMessage(state, { id: "m1", reason: "moderator" });
    expect(state.messages[0]).toMatchObject({
      body: "",
      deletion: { reason: "moderator" },
      reactions: [],
    });
    expect(state.pin).toBeNull();
  });
});

describe("reactions", () => {
  test("applyReaction sets a total and keeps the viewer's mark unless the frame names them", () => {
    let state = mergeMessages(EMPTY_CAL_CHAT, [
      message(1, { reactions: [{ emoji: "👍", count: 1, mine: true }] }),
    ]);
    state = applyReaction(state, { messageId: "m1", emoji: "👍", count: 3 });
    expect(state.messages[0].reactions).toEqual([{ emoji: "👍", count: 3, mine: true }]);
    state = applyReaction(state, { messageId: "m1", emoji: "👍", count: 0, mine: false });
    expect(state.messages[0].reactions).toEqual([]);
  });

  test("toggleOwnReaction adds then removes the viewer's emoji optimistically", () => {
    const start = mergeMessages(EMPTY_CAL_CHAT, [message(1)]);
    const on = toggleOwnReaction(start, { messageId: "m1", emoji: "🎉" });
    expect(on.active).toBe(true);
    expect(on.state.messages[0].reactions).toEqual([{ emoji: "🎉", count: 1, mine: true }]);
    const off = toggleOwnReaction(on.state, { messageId: "m1", emoji: "🎉" });
    expect(off.active).toBe(false);
    expect(off.state.messages[0].reactions).toEqual([]);
  });
});

describe("members", () => {
  test("mute follows the viewer when it names them", () => {
    let state = memberJoined(EMPTY_CAL_CHAT, speaker("me"));
    state = setMemberMuted(state, { participantId: "me", muted: true, viewerId: "me" });
    expect(state.muted).toBe(true);
    expect(state.members[0].muted).toBe(true);
    state = memberLeft(state, "me");
    expect(state.members).toEqual([]);
  });
});

describe("sequence helpers", () => {
  test("newestSeq and firstGapAfter", () => {
    const state = mergeMessages(EMPTY_CAL_CHAT, [message(1), message(2), message(5)]);
    expect(newestSeq(state)).toBe(5);
    expect(firstGapAfter(state.messages, 0)).toBe(2);
    expect(firstGapAfter([message(1), message(2)], 0)).toBeNull();
  });
});

describe("countCalChatUnread", () => {
  test("counts others' live text messages past what was seen or read", () => {
    const messages = [
      message(1),
      message(2, { speaker: speaker("me") }),
      message(3, { kind: "pin" }),
      message(4, { deletion: { reason: "sender" } }),
      message(5),
    ];
    expect(countCalChatUnread({ messages, viewerId: "me", lastSeenSeq: 0, readSeq: 1 })).toBe(1);
    expect(countCalChatUnread({ messages, viewerId: "me", lastSeenSeq: 5, readSeq: 0 })).toBe(0);
  });
});
