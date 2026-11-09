const { CalChatSocketClient } = require("./socket-client");

test("routes call frames separately from six-emoji chat reactions and sends exact client frames", async () => {
  let handlers;
  const socket = { send: jest.fn(), close: jest.fn(), isOpen: () => true };
  const onCallFrame = jest.fn();
  const onFrame = jest.fn();
  const client = new CalChatSocketClient({
    url: "wss://cal.video/api/chat/socket",
    fetchToken: async () => "token",
    createSocket: (_url, callbacks) => {
      handlers = callbacks;
      return socket;
    },
    onConnection: jest.fn(),
    onCallFrame,
    onFrame,
  });
  client.start();
  await new Promise((resolve) => setImmediate(resolve));
  handlers.onMessage(JSON.stringify({ type: "ready" }));
  const messageReaction = {
    type: "reaction",
    messageId: "message",
    participantId: "person",
    emoji: "👍",
    count: 1,
  };
  handlers.onMessage(JSON.stringify(messageReaction));
  handlers.onMessage(
    JSON.stringify({ type: "reaction", participantId: "person", emoji: "👏", count: 30 })
  );
  handlers.onMessage(
    JSON.stringify({ type: "transcription.state", state: { on: true, epoch: 1, version: 1 } })
  );
  handlers.onMessage(
    JSON.stringify({
      type: "caption",
      caption: { participantId: "person", seq: 1, text: "Hello", final: true },
    })
  );
  expect(onFrame).toHaveBeenCalledWith(messageReaction);
  expect(onCallFrame.mock.calls.map(([frame]) => frame.type)).toEqual([
    "reaction",
    "transcription.state",
    "caption",
  ]);
  expect(onCallFrame.mock.calls[0][0].count).toBe(20);
  expect(client.send({ type: "reaction", emoji: "👎", count: 2 })).toBe(true);
  expect(socket.send).toHaveBeenLastCalledWith(
    JSON.stringify({ type: "reaction", emoji: "👎", count: 2 })
  );
  client.stop();
  expect(client.send({ type: "reaction", emoji: "👎", count: 2 })).toBe(false);
});

test("drops malformed call frames and preserves the chat emoji palette", () => {
  const { calChatCallFrameSchema, calChatServerFrameSchema } = require("./types");
  expect(
    calChatCallFrameSchema.safeParse({
      type: "reaction",
      participantId: "person",
      emoji: "👏",
      count: 0,
    }).success
  ).toBe(false);
  expect(
    calChatCallFrameSchema.safeParse({
      type: "caption",
      caption: { participantId: "person", seq: 1, text: "x".repeat(201), final: true },
    }).success
  ).toBe(false);
  expect(
    calChatServerFrameSchema.safeParse({
      type: "reaction",
      messageId: "message",
      emoji: "👏",
      count: 1,
    }).success
  ).toBe(false);
});
