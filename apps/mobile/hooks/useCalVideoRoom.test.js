import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// The room API is the test boundary: what the join carries is the behaviour under test.
const mockJoinRoom = jest.fn();
jest.mock("@/services/cal-video/api", () => ({
  endMeeting: jest.fn(),
  joinRoom: (...args) => mockJoinRoom(...args),
  knockRoom: jest.fn(),
  knockStatus: jest.fn(),
  leaveRoom: jest.fn(),
}));

const { act, renderHook } = require("@testing-library/react-native");
const { useCalVideoRoom } = require("./useCalVideoRoom");

const LINK = {
  kind: "room",
  origin: "https://cal.video",
  host: "cal.video",
  orgSlug: null,
  slug: "hornet-yarrow-dune",
  inviteToken: null,
  url: "https://cal.video/hornet-yarrow-dune",
};

async function joinWith(getAccessToken) {
  const { result } = await renderHook(() => useCalVideoRoom({ link: LINK, getAccessToken }));
  await act(() => result.current.join("Ana"));
  return result;
}

describe("useCalVideoRoom join", () => {
  beforeEach(() => {
    mockJoinRoom.mockReset();
    mockJoinRoom.mockResolvedValue({ kind: "failure", failure: "not-found" });
  });

  test("sends the renewed token, so an owner whose app sat open is still the host", async () => {
    await joinWith(() => Promise.resolve("renewed"));

    expect(mockJoinRoom).toHaveBeenCalledTimes(1);
    expect(mockJoinRoom).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "hornet-yarrow-dune", accessToken: "renewed" })
    );
  });

  test("sends no token for a signed-out guest", async () => {
    await joinWith(() => Promise.resolve(null));

    expect(mockJoinRoom).toHaveBeenCalledTimes(1);
    expect(mockJoinRoom).toHaveBeenCalledWith(expect.objectContaining({ accessToken: null }));
  });

  test("still joins, with no token, when the token can't be read", async () => {
    const result = await joinWith(() => Promise.reject(new Error("storage unavailable")));

    expect(mockJoinRoom).toHaveBeenCalledTimes(1);
    expect(mockJoinRoom).toHaveBeenCalledWith(expect.objectContaining({ accessToken: null }));
    expect(result.current.joining).toBe(false);
  });
});
