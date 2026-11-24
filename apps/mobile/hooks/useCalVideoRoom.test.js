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
const mockConsentRoute = jest.fn();
jest.mock("@/services/cal-video/booking-api", () => ({
  admitToBooking: (...args) => mockAdmit(...args),
  fetchBookingSpeechConsent: (...args) => mockConsentRoute(...args),
  joinBookingSession: (...args) => mockSessionJoin(...args),
}));

const { act, renderHook, waitFor } = require("@testing-library/react-native");
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
    mockConsentRoute.mockReset();
  });

  test("sends the renewed token, so an owner whose app sat open is still the host", async () => {
    await joinWith(() => Promise.resolve("renewed"));
    expect(mockConsentRoute).not.toHaveBeenCalled();

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
    mockConsentRoute.mockReset();
    mockConsentRoute.mockResolvedValue(null);
  });

  async function render(link = BOOKING, getAccessToken = () => Promise.resolve("oauth")) {
    const { result } = await renderHook(() => useCalVideoRoom({ link, getAccessToken }));
    return result;
  }

  /** Lets the up-front ask finish, for checks that it changed nothing. */
  async function afterTheAsk() {
    await waitFor(() => expect(mockConsentRoute).toHaveBeenCalled());
    await act(async () => {});
  }

  const consent = { version: "3.0", helpUrl: "https://example.com/help", captionsOn: true };

  test("signed in, shows the route's checkbox before any join", async () => {
    mockConsentRoute.mockResolvedValue(consent);
    const result = await render();

    await waitFor(() => expect(result.current.speechConsentPrompt).toEqual(consent));
    expect(mockConsentRoute).toHaveBeenCalledWith({ call: BOOKING, accessToken: "oauth" });
    expect(mockAdmit).not.toHaveBeenCalled();
  });

  test("signed in as a member of the account, no checkbox", async () => {
    const result = await render({ ...BOOKING, speechConsent: consent });
    await afterTheAsk();

    expect(result.current.speechConsentPrompt).toBeNull();
  });

  test("signed out, the route isn't asked: the page's checkbox is the answer", async () => {
    const result = await render(BOOKING, () => Promise.resolve(null));
    await act(async () => {});

    expect(mockConsentRoute).not.toHaveBeenCalled();
    expect(result.current.speechConsentPrompt).toBeNull();
  });

  test("a failed ask leaves the checkbox to the session join", async () => {
    mockConsentRoute.mockRejectedValue(new Error("offline"));
    mockAdmit.mockResolvedValue({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValueOnce({ kind: "consent-required" });
    const result = await render({ ...BOOKING, speechConsent: consent });
    await afterTheAsk();
    expect(result.current.speechConsentPrompt).toBeNull();

    await act(() => result.current.join("Ana"));
    expect(result.current.speechConsentPrompt).toEqual(consent);
    expect(result.current.failure).toBeNull();
  });

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

  test("shows the speech-processing checkbox once the call asks, then joins with the tick", async () => {
    const consent = { version: "3.0", helpUrl: "https://example.com/help", captionsOn: true };
    const admitted = { kind: "admitted", token: "embed", sessionId: "s1", redirectUrl: null };
    mockAdmit.mockResolvedValue(admitted);
    mockSessionJoin.mockResolvedValueOnce({ kind: "consent-required" });
    const result = await render({ ...BOOKING, speechConsent: consent });
    expect(result.current.speechConsentPrompt).toBeNull();

    await act(() => result.current.join("Ana"));
    expect(result.current.speechConsentPrompt).toEqual(consent);
    expect(result.current.failure).toBeNull();
    expect(result.current.grant).toBeNull();

    mockSessionJoin.mockResolvedValueOnce({
      kind: "admitted",
      grant: GRANT,
      roomSlug: "booking-room",
    });
    await act(() => result.current.join("Ana", null, { agreed: true, version: "3.0" }));
    expect(mockSessionJoin).toHaveBeenLastCalledWith(
      expect.objectContaining({ speechConsent: { agreed: true, version: "3.0" } })
    );
    expect(result.current.grant).toBe(GRANT);
  });

  test("keeps a refused tick's message until the next join", async () => {
    mockAdmit.mockResolvedValue({
      kind: "admitted",
      token: "embed",
      sessionId: "s1",
      redirectUrl: null,
    });
    mockSessionJoin.mockResolvedValueOnce({ kind: "consent-refused", refusal: "retry" });
    const result = await render();

    await act(() => result.current.join("Ana", null, { agreed: true, version: "3.0" }));
    expect(result.current.speechConsentRefusal).toBe("retry");
    expect(result.current.failure).toBeNull();

    mockSessionJoin.mockResolvedValueOnce({
      kind: "admitted",
      grant: GRANT,
      roomSlug: "booking-room",
    });
    await act(() => result.current.join("Ana", null, { agreed: true, version: "3.0" }));
    expect(result.current.speechConsentRefusal).toBeNull();
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
