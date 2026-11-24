import { describe, expect, jest, test } from "@jest/globals";

const mockHandlers = new Map();
// The node preset resolves `react-native` to react-native-web.
jest.mock("react-native-web/dist/exports/Platform", () => ({
  __esModule: true,
  default: { OS: "ios" },
}));
jest.mock("expo-crypto", () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-0000-0000-00000000000${++n}` };
});
jest.mock("@/utils/safeLogger", () => ({ safeLogWarn: () => undefined }));
jest.mock("react-native-callkeep", () => ({
  CONSTANTS: { END_CALL_REASONS: {} },
  default: {
    setup: () => Promise.resolve(),
    startCall: () => undefined,
    endCall: () => undefined,
    reportConnectedOutgoingCallWithUUID: () => undefined,
    addEventListener: (type, handler) => {
      if (!mockHandlers.has(type)) mockHandlers.set(type, new Set());
      mockHandlers.get(type).add(handler);
      return { remove: () => mockHandlers.get(type).delete(handler) };
    },
  },
}));

const { isCallKitBackingOut, NativeCallSession } = require("./native-call");

const emit = (type, body) => {
  for (const handler of mockHandlers.get(type) ?? []) handler(body);
};

async function startedSession() {
  const onEndCall = jest.fn();
  const session = new NativeCallSession({ onEndCall, onSetMuted: () => undefined });
  expect(await session.start({ handle: "i.cal.video/a", displayName: "a", hasVideo: true })).toBe(
    true
  );
  emit("didReceiveStartCallAction", { callUUID: session.uuid.toUpperCase() });
  return { session, onEndCall };
}

describe("NativeCallSession", () => {
  test("CallKit backing out before media keeps the call, even after the start action", async () => {
    const { onEndCall, session } = await startedSession();
    emit("endCall", { callUUID: session.uuid });
    expect(onEndCall).not.toHaveBeenCalled();
  });

  test("CallKit backing out seconds after the start keeps the call while joining", async () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    const onEndCall = jest.fn();
    const session = new NativeCallSession({ onEndCall, onSetMuted: () => undefined });
    await session.start({ handle: "i.cal.video/a", displayName: "a", hasVideo: true });
    now.mockReturnValue(6_000);
    emit("didReceiveStartCallAction", { callUUID: session.uuid });
    emit("endCall", { callUUID: session.uuid });
    expect(onEndCall).not.toHaveBeenCalled();
    now.mockRestore();
  });

  test("an end once media flows is a hang-up", async () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    const { onEndCall, session } = await startedSession();
    session.connected();
    now.mockReturnValue(3_000);
    emit("endCall", { callUUID: session.uuid });
    expect(onEndCall).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });
});

describe("isCallKitBackingOut", () => {
  test("a system end before media flows keeps the call, however late CallKit answered", () => {
    expect(isCallKitBackingOut({ mediaConnected: false, acceptedAt: 0, now: 60_000 })).toBe(true);
  });

  test("a system end just after CallKit accepts a live call keeps the call", () => {
    expect(isCallKitBackingOut({ mediaConnected: true, acceptedAt: 5_000, now: 5_500 })).toBe(true);
  });

  test("a system end once the call is live and settled is the person hanging up", () => {
    expect(isCallKitBackingOut({ mediaConnected: true, acceptedAt: 5_000, now: 7_000 })).toBe(
      false
    );
  });
});
