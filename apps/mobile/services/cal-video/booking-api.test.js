import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockFetch = jest.fn();
jest.mock("@/utils/network", () => ({ fetchWithTimeout: (...args) => mockFetch(...args) }));

const {
  admissionFailure,
  admitToBooking,
  joinBookingSession,
  sessionJoinFailure,
  speechConsentRefusalFor,
} = require("./booking-api");

const call = {
  kind: "booking-call",
  appOrigin: "https://app.cal.com",
  host: "app.cal.com",
  bookingUid: "r63umUSdfs8QX7ajaYiYhy",
  url: "https://app.cal.com/video/r63umUSdfs8QX7ajaYiYhy",
  videoOrigin: "https://cal.video",
  requireEmail: false,
};
const reply = (body, status = 200) => ({ status, ok: status < 400, json: async () => body });

const grant = {
  sessionId: "s1",
  roomId: "r1",
  participantId: "p1",
  displayName: "Guest",
  avatarUrl: null,
  role: "participant",
  capabilities: {
    canRecord: true,
    canTranscribe: true,
    canScreenShare: true,
    canPublishVideo: true,
    canChat: true,
    canAdmit: false,
    canEndForEveryone: false,
    canRemoveParticipant: false,
    maxParticipants: 100,
  },
  expiresAt: 1,
  sessionEndsAt: 2,
  controlToken: "ct",
  transport: "sfu",
  provider: "realtimekit",
  session: {
    baseUrl: "https://rtk.example",
    meetingId: "m1",
    authToken: "auth",
    hostPresetName: "host",
  },
  bookingAutoStart: { recording: "server", transcription: "off" },
};

describe("admission", () => {
  beforeEach(() => mockFetch.mockReset());

  test("posts the name to the booking's admission, with the app's token, and keeps the cookie", async () => {
    mockFetch.mockResolvedValue(reply({ token: "embed", sessionId: "s1", redirectUrl: null }));

    await expect(
      admitToBooking({ call, displayName: "Guest", email: "  ", accessToken: "oauth" })
    ).resolves.toEqual({ kind: "admitted", token: "embed", sessionId: "s1", redirectUrl: null });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://app.cal.com/api/video/booking-admission/r63umUSdfs8QX7ajaYiYhy");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers.Authorization).toBe("Bearer oauth");
    // The server's schema is strict: an empty email would fail it, so it is left out.
    expect(JSON.parse(init.body)).toEqual({ displayName: "Guest" });
  });

  test("sends an email when there is one, and no Authorization for a signed-out guest", async () => {
    mockFetch.mockResolvedValue(reply({ token: "embed", sessionId: "s1" }));

    await admitToBooking({ call, displayName: "Guest", email: " ana@example.com " });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ displayName: "Guest", email: "ana@example.com" });
  });

  test("a 200 without a token or session is not an admission", async () => {
    mockFetch.mockResolvedValue(reply({ token: "embed" }));

    await expect(admitToBooking({ call, displayName: "Guest" })).resolves.toEqual({
      kind: "failure",
      failure: "error",
    });
  });

  test("reads each refusal the way the web page does", () => {
    expect(admissionFailure(403, "email-required")).toEqual({ kind: "email-required" });
    expect(admissionFailure(403, "meeting-full")).toEqual({ kind: "failure", failure: "full" });
    expect(admissionFailure(429, "rate-limited")).toEqual({
      kind: "failure",
      failure: "rate-limited",
    });
    expect(admissionFailure(404, "not-found")).toEqual({ kind: "failure", failure: "not-found" });
    expect(admissionFailure(410, "meeting-ended")).toEqual({
      kind: "failure",
      failure: "not-found",
    });
    // The web page explains these and can sign a host in; the app hands them to it.
    for (const [status, outcome] of [
      [403, "host-must-sign-in"],
      [403, "email-not-attendee"],
      [409, "meeting-too-long"],
      [503, "meeting-unavailable"],
    ]) {
      expect(admissionFailure(status, outcome)).toEqual({ kind: "failure", failure: "needs-web" });
    }
    expect(admissionFailure(400, "invalid-input")).toEqual({ kind: "failure", failure: "error" });
  });
});

describe("session join", () => {
  beforeEach(() => mockFetch.mockReset());

  test("joins with the embed token alone and returns the grant and its room", async () => {
    mockFetch.mockResolvedValue(reply({ grant, roomSlug: "booking-room" }));

    const result = await joinBookingSession({ call, sessionId: "s1", token: "embed" });

    expect(result).toEqual({
      kind: "admitted",
      grant: expect.objectContaining({
        role: "participant",
        controlToken: "ct",
        bookingAutoStart: { recording: "server", transcription: "off" },
      }),
      roomSlug: "booking-room",
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://cal.video/api/sessions/s1/join");
    expect(init.credentials).toBe("omit");
    expect(init.headers.Authorization).toBe("Bearer embed");
    expect(init.body).toBe("{}");
  });

  test("a grant without its room is unusable", async () => {
    mockFetch.mockResolvedValue(reply({ grant }));

    await expect(joinBookingSession({ call, sessionId: "s1", token: "embed" })).resolves.toEqual({
      kind: "failure",
      failure: "error",
    });
  });

  test("reads the session join's refusals", () => {
    expect(sessionJoinFailure(404, { outcome: "not-found" })).toBe("not-found");
    expect(sessionJoinFailure(403, { outcome: "full" })).toBe("full");
    expect(sessionJoinFailure(429, {})).toBe("rate-limited");
    expect(sessionJoinFailure(503, { outcome: "unavailable" })).toBe("error");
  });

  test("reads a refused tick the way the web pre-join does", () => {
    expect(speechConsentRefusalFor("speech_consent_required")).toBe("reload");
    expect(speechConsentRefusalFor("speech_consent_stale")).toBe("reload");
    expect(speechConsentRefusalFor("speech_consent_unsaved")).toBe("retry");
    expect(speechConsentRefusalFor(undefined)).toBeNull();
  });

  const consentCall = {
    ...call,
    speechConsent: { version: "3.0", helpUrl: "https://example.com/help", captionsOn: true },
  };
  const consentRefusal = reply({ outcome: "error", reason: "speech_consent_required" }, 403);

  test("asks for the tick when the call wants one and the page showed the checkbox", async () => {
    mockFetch.mockResolvedValue(consentRefusal);

    await expect(
      joinBookingSession({ call: consentCall, sessionId: "s1", token: "embed" })
    ).resolves.toEqual({ kind: "consent-required" });
  });

  test("a tick the page had no checkbox for gets the web's reload message", async () => {
    mockFetch.mockResolvedValue(consentRefusal);

    await expect(joinBookingSession({ call, sessionId: "s1", token: "embed" })).resolves.toEqual({
      kind: "consent-refused",
      refusal: "reload",
    });
  });

  test("carries the tick with the wording version it agrees to", async () => {
    mockFetch.mockResolvedValue(reply({ grant, roomSlug: "booking-room" }));

    const result = await joinBookingSession({
      call: consentCall,
      sessionId: "s1",
      token: "embed",
      speechConsent: { agreed: true, version: "3.0" },
    });

    expect(result.kind).toBe("admitted");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      speechConsent: { agreed: true, version: "3.0" },
    });
  });

  test("never loops: asked again after sending a tick, it's the reload message", async () => {
    mockFetch.mockResolvedValue(consentRefusal);

    await expect(
      joinBookingSession({
        call: consentCall,
        sessionId: "s1",
        token: "embed",
        speechConsent: { agreed: true, version: "3.0" },
      })
    ).resolves.toEqual({ kind: "consent-refused", refusal: "reload" });
  });

  test("a tick that couldn't be saved asks to join again", async () => {
    mockFetch.mockResolvedValue(reply({ outcome: "error", reason: "speech_consent_unsaved" }, 500));

    await expect(
      joinBookingSession({
        call: consentCall,
        sessionId: "s1",
        token: "embed",
        speechConsent: { agreed: true, version: "3.0" },
      })
    ).resolves.toEqual({ kind: "consent-refused", refusal: "retry" });
  });
});
