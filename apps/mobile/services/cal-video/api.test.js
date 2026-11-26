import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockFetch = jest.fn();
jest.mock("@/utils/network", () => ({ fetchWithTimeout: (...args) => mockFetch(...args) }));

const {
  fetchRoomSpeechConsent,
  joinRoom,
  knockRoom,
  knockStatus,
  setTranscription,
} = require("./api");

const room = { origin: "https://cal.video", slug: "room" };
const reply = (body, status = 200) => ({ status, ok: status < 400, json: async () => body });

describe("speech consent on a room join", () => {
  beforeEach(() => mockFetch.mockReset());

  const tick = { agreed: true, version: "3.0" };

  test("asks for the checkbox when the server wants a tick and none was sent", async () => {
    mockFetch.mockResolvedValue(
      reply({ outcome: "error", reason: "speech_consent_required" }, 403)
    );

    await expect(joinRoom({ ...room, displayName: "Guest" })).resolves.toEqual({
      kind: "consent-required",
    });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).speechConsent).toBeUndefined();
  });

  test("sends the tick with the join", async () => {
    mockFetch.mockResolvedValue(reply({}, 500));

    await joinRoom({ ...room, displayName: "Guest", speechConsent: tick });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      displayName: "Guest",
      speechConsent: tick,
    });
  });

  test("shows the web's message rather than asking again when a sent tick is refused", async () => {
    mockFetch
      .mockResolvedValueOnce(reply({ outcome: "error", reason: "speech_consent_required" }, 403))
      .mockResolvedValueOnce(reply({ outcome: "error", reason: "speech_consent_unsaved" }, 500));

    await expect(joinRoom({ ...room, displayName: "Guest", speechConsent: tick })).resolves.toEqual(
      { kind: "consent-refused", refusal: "reload" }
    );
    await expect(joinRoom({ ...room, displayName: "Guest", speechConsent: tick })).resolves.toEqual(
      { kind: "consent-refused", refusal: "retry" }
    );
  });

  test("reads the checkbox from the room's page", async () => {
    const html =
      '<script>self.__next_f.push([1,"{\\"speechConsent\\":{\\"version\\":\\"3.0\\",\\"helpUrl\\":\\"https://cal.com/help/privacy-and-compliance/elevenlabs\\",\\"captionsOn\\":false},\\"viewerAvatarUrl\\":null}"])</script>';
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    await expect(fetchRoomSpeechConsent(room)).resolves.toEqual({
      version: "3.0",
      helpUrl: "https://cal.com/help/privacy-and-compliance/elevenlabs",
      captionsOn: false,
    });
    expect(mockFetch.mock.calls[0][0]).toBe("https://cal.video/room");
  });

  test("has no checkbox for a page that shows none", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "<html></html>" });

    await expect(fetchRoomSpeechConsent(room)).resolves.toBeNull();
  });
});

describe("the knock", () => {
  beforeEach(() => mockFetch.mockReset());

  test("waits on the server's answer alone: the cookie identifies the knock, not the body", async () => {
    mockFetch.mockResolvedValue(reply({ outcome: "waiting", expiresInSeconds: 120 }));

    await expect(knockRoom(room, "Guest")).resolves.toEqual({
      outcome: "waiting",
      expiresInSeconds: 120,
    });
  });

  test("goes straight in when the host has already admitted this person", async () => {
    mockFetch.mockResolvedValue(reply({ outcome: "admitted" }));

    await expect(knockRoom(room, "Guest")).resolves.toEqual({ outcome: "admitted" });
  });

  test("polls without sending anything but the cookie", async () => {
    mockFetch.mockResolvedValue(reply({ state: "admitted" }));

    await expect(knockStatus(room)).resolves.toEqual({ state: "admitted" });
    expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
  });
});

describe("captions control", () => {
  beforeEach(() => mockFetch.mockReset());

  test("posts the grant's control token and returns the authoritative state", async () => {
    const state = { on: true, epoch: 1, version: 2 };
    mockFetch.mockResolvedValue(reply({ state }));
    await expect(
      setTranscription(room, { controlToken: "control", action: "start" })
    ).resolves.toEqual(state);
    expect(mockFetch.mock.calls[0][0]).toBe("https://cal.video/api/rooms/room/transcription");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      controlToken: "control",
      action: "start",
    });
  });

  test("rejects denied and empty responses rather than showing captions as on", async () => {
    mockFetch.mockResolvedValueOnce(reply({}, 403)).mockResolvedValueOnce(reply({}));
    await expect(
      setTranscription(room, { controlToken: "control", action: "stop" })
    ).rejects.toThrow("403");
    await expect(
      setTranscription(room, { controlToken: "control", action: "start" })
    ).rejects.toThrow();
  });
});
