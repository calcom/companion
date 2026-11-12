import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";

const mockToChatId = jest.fn();
jest.mock("expo-crypto", () => ({ randomUUID: () => "reaction-id" }));
jest.mock("@/services/cal-video/cal-chat/participant-id", () => ({
  toCalChatParticipantId: (id) => mockToChatId(id),
}));
const { act, renderHook } = require("@testing-library/react-native");
const { useGatewayCall } = require("./useGatewayCall");

const participants = [
  { id: "local", identityId: "me", isLocal: true, displayName: "Me" },
  { id: "remote", identityId: "them", isLocal: false, displayName: "Ana" },
];
const input = { sessionId: "session", participants, providerReactions: false };
beforeEach(() => mockToChatId.mockImplementation(async (id) => `chat-${id}`));
afterEach(() => jest.useRealTimers());

test("delivers pending reactions and captions using the newest participant index after repeated rebuilds", async () => {
  const pending = [];
  mockToChatId.mockImplementation(
    (id) => new Promise((resolve) => pending.push(() => resolve(`chat-${id}`)))
  );
  const { result, rerender } = await renderHook((props) => useGatewayCall(props), {
    initialProps: input,
  });
  const first = pending.splice(0);
  await act(async () => {
    result.current.receiveState({ on: true, epoch: 1, version: 1 });
    result.current.onFrame({
      type: "reaction",
      participantId: "chat-them",
      emoji: "👏",
      count: 3,
    });
    result.current.onFrame({
      type: "caption",
      caption: { participantId: "chat-them", seq: 1, text: "Hello", final: true },
    });
  });
  await rerender({
    ...input,
    participants: participants.map((person) => ({ ...person, hasAudio: false })),
  });
  const second = pending.splice(0);
  await act(async () => {
    for (const resolve of first) resolve();
  });
  expect(result.current.reactions).toEqual([]);
  expect(result.current.lines).toEqual([]);
  await rerender({
    ...input,
    participants: participants.map((person) => ({
      ...person,
      id: `new-${person.id}`,
      displayName: `Updated ${person.displayName}`,
      hasVideo: false,
    })),
  });
  const third = pending.splice(0);
  await act(async () => {
    for (const resolve of second) resolve();
  });
  expect(result.current.reactions).toEqual([]);
  expect(result.current.lines).toEqual([]);
  await act(async () => {
    for (const resolve of third) resolve();
  });
  expect(result.current.reactions).toEqual([
    expect.objectContaining({ participantId: "new-remote", emoji: "👏", count: 3 }),
  ]);
  expect(result.current.lines).toEqual([
    expect.objectContaining({
      participantId: "new-remote",
      participantName: "Updated Ana",
      text: "Hello",
    }),
  ]);
});

test("maps gateway senders and ignores own, unknown and provider reactions", async () => {
  const { result, rerender } = await renderHook((props) => useGatewayCall(props), {
    initialProps: input,
  });
  const frame = { type: "reaction", participantId: "chat-them", emoji: "👏", count: 3 };
  await act(async () => {
    result.current.onFrame(frame);
    result.current.onFrame({ ...frame, participantId: "chat-me" });
    result.current.onFrame({ ...frame, participantId: "unknown" });
  });
  expect(result.current.reactions).toEqual([
    expect.objectContaining({ participantId: "remote", emoji: "👏", count: 3 }),
  ]);
  await rerender({ ...input, providerReactions: true });
  await act(async () => result.current.onFrame(frame));
  expect(result.current.reactions).toHaveLength(1);
});

test("sends the first reaction immediately, flushes capped runs, and cancels on leave", async () => {
  jest.useFakeTimers();
  const send = jest.fn(() => true);
  const { result, unmount } = await renderHook(() => useGatewayCall(input));
  await act(async () => {
    for (let i = 0; i < 23; i++) result.current.sendReaction("❤️", send);
    result.current.sendReaction("👎", send);
  });
  expect(send.mock.calls).toEqual([[{ type: "reaction", emoji: "❤️", count: 1 }]]);
  await act(async () => jest.advanceTimersByTime(750));
  expect(send.mock.calls.slice(1)).toEqual([
    [{ type: "reaction", emoji: "❤️", count: 20 }],
    [{ type: "reaction", emoji: "❤️", count: 2 }],
    [{ type: "reaction", emoji: "👎", count: 1 }],
  ]);
  await act(async () => {
    result.current.sendReaction("👏", send);
    result.current.sendReaction("👏", send);
  });
  const sent = send.mock.calls.length;
  await unmount();
  jest.runAllTimers();
  expect(send).toHaveBeenCalledTimes(sent);
});

test("does not send without a local participant", async () => {
  const send = jest.fn();
  const { result } = await renderHook(() => useGatewayCall({ ...input, participants: [] }));
  await act(async () => result.current.sendReaction("👏", send));
  expect(send).not.toHaveBeenCalled();
  expect(result.current.reactions).toEqual([]);
});

test("receives everyone's captions, replaces interims, ignores duplicates and older state", async () => {
  const { result } = await renderHook(() => useGatewayCall(input));
  const caption = {
    type: "caption",
    caption: { participantId: "chat-them", seq: 1, text: "Hello", final: false },
  };
  await act(async () => result.current.onFrame(caption));
  expect(result.current.lines).toEqual([]);
  await act(async () =>
    result.current.onFrame({
      type: "transcription.state",
      state: { on: true, epoch: 1, version: 1 },
    })
  );
  await act(async () => result.current.onFrame(caption));
  await act(async () =>
    result.current.onFrame({
      ...caption,
      caption: { ...caption.caption, text: "Hello world", final: true },
    })
  );
  await act(async () => {
    result.current.onFrame({
      ...caption,
      caption: { ...caption.caption, text: "Hello world", final: true },
    });
    result.current.onFrame({
      ...caption,
      caption: { ...caption.caption, participantId: "unknown" },
    });
    result.current.onFrame({
      type: "transcription.state",
      state: { on: false, epoch: 0, version: 0 },
    });
  });
  expect(result.current.lines).toEqual([
    expect.objectContaining({
      participantId: "remote",
      participantName: "Ana",
      text: "Hello world",
      final: true,
    }),
  ]);
  expect(result.current.transcription.on).toBe(true);
  await act(async () => result.current.receiveState({ on: false, epoch: 1, version: 2 }));
  expect(result.current.lines).toEqual([]);
  expect(result.current.transcription.on).toBe(false);
});
