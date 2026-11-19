import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// The room API is the test boundary: what the join carries is the behaviour under test.
const mockJoinRoom = jest.fn();
const mockLeaveRoom = jest.fn();
jest.mock("@/services/cal-video/api", () => ({
  endMeeting: jest.fn(),
  joinRoom: (...args) => mockJoinRoom(...args),
  knockRoom: jest.fn(),
  knockStatus: jest.fn(),
  leaveRoom: (...args) => mockLeaveRoom(...args),
}));
const mockAdmit = jest.fn();
const mockSessionJoin = jest.fn();
jest.mock("@/services/cal-video/booking-api", () => ({
  admitToBooking: (...args) => mockAdmit(...args),
  joinBookingSession: (...args) => mockSessionJoin(...args),
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

const BOOKING = {
  kind: "booking-call",
  appOrigin: "https://app.cal.com",
  host: "app.cal.com",
  bookingUid: "r63umUSdfs8QX7ajaYiYhy",
  url: "https://app.cal.com/video/r63umUSdfs8QX7ajaYiYhy",
  videoOrigin: "https://cal.video",
  requireEmail: false,
};
const GRANT = { sessionId: "s1", controlToken: "ct", role: "participant", transport: "loopback" };

describe("useCalVideoRoom with a 2.0 booking call", () => {
  beforeEach(() => {
    mockJoinRoom.mockReset();
    mockLeaveRoom.mockReset();
    mockAdmit.mockReset();
    mockSessionJoin.mockReset();
  });

  async function render(link = BOOKING) {
    const { result } = await renderHook(() =>
      useCalVideoRoom({ link, getAccessToken: () => Promise.resolve("oauth") })
    );
    return result;
  }

  test("admits on the web app, joins the session, and learns the booking's room", async () => {
    mockAdmit.mockResolvedValue({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValue({ kind: "admitted", grant: GRANT, roomSlug: "booking-room" });
    const result = await render();
    expect(result.current.room).toBeNull();

    await act(() => result.current.join("Ana"));

    expect(mockJoinRoom).not.toHaveBeenCalled();
    expect(mockAdmit).toHaveBeenCalledWith({
      call: BOOKING,
      displayName: "Ana",
      email: null,
      accessToken: "oauth",
    });
    expect(mockSessionJoin).toHaveBeenCalledWith({
      call: BOOKING,
      sessionId: "s1",
      token: "embed",
    });
    expect(result.current.grant).toBe(GRANT);
    expect(result.current.room).toEqual({ origin: "https://cal.video", slug: "booking-room" });
    expect(result.current.embedToken).toBe("embed");
    expect(result.current.knock).toEqual({ status: "idle" });
  });

  test("asks for an email when the booking wants one, then admits with it", async () => {
    mockAdmit.mockResolvedValueOnce({ kind: "email-required" });
    const result = await render();

    await act(() => result.current.join("Ana"));
    expect(result.current.emailRequired).toBe(true);
    expect(result.current.failure).toBeNull();
    expect(result.current.grant).toBeNull();
    expect(mockSessionJoin).not.toHaveBeenCalled();

    mockAdmit.mockResolvedValueOnce({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValueOnce({
      kind: "admitted",
      grant: GRANT,
      roomSlug: "booking-room",
    });
    await act(() => result.current.join("Ana", "ana@example.com"));
    expect(mockAdmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: "ana@example.com" })
    );
    expect(result.current.grant).toBe(GRANT);
  });

  test("starts with the email field when the page already says so", async () => {
    const result = await render({ ...BOOKING, requireEmail: true });
    expect(result.current.emailRequired).toBe(true);
  });

  test("a refusal at either step is the failure shown", async () => {
    mockAdmit.mockResolvedValueOnce({ kind: "failure", failure: "needs-web" });
    const result = await render();
    await act(() => result.current.join("Ana"));
    expect(result.current.failure).toBe("needs-web");

    mockAdmit.mockResolvedValueOnce({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValueOnce({ kind: "failure", failure: "full" });
    await act(() => result.current.join("Ana"));
    expect(result.current.failure).toBe("full");
    expect(result.current.grant).toBeNull();
  });

  test("leaving tells the booking's room, with the grant's control token", async () => {
    mockAdmit.mockResolvedValue({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValue({ kind: "admitted", grant: GRANT, roomSlug: "booking-room" });
    const result = await render();
    await act(() => result.current.join("Ana"));

    await act(() => result.current.leave());

    expect(mockLeaveRoom).toHaveBeenCalledWith(
      { origin: "https://cal.video", slug: "booking-room" },
      "ct"
    );
    expect(result.current.sessionEnd).toBe("left");
  });
});
