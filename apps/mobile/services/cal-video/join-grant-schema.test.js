import { describe, expect, test } from "@jest/globals";

const { joinGrantSchema } = require("./join-grant-schema");

const common = {
  sessionId: "s1",
  roomId: "r1",
  participantId: "p1",
  displayName: "Peer",
  avatarUrl: null,
  role: "host",
  capabilities: {
    canRecord: false,
    canTranscribe: false,
    canScreenShare: true,
    canPublishVideo: true,
    canChat: true,
    canAdmit: true,
    canEndForEveryone: true,
    canRemoveParticipant: true,
    maxParticipants: 20,
  },
  expiresAt: 1,
  sessionEndsAt: 2,
  controlToken: "ct",
};

describe("joinGrantSchema", () => {
  test("accepts a Daily grant and narrows its session", () => {
    const grant = joinGrantSchema.parse({
      ...common,
      transport: "sfu",
      provider: "daily",
      session: { roomUrl: "https://cal.daily.co/abc", meetingToken: "tok" },
      unknownFutureField: 1,
    });
    expect(grant.provider).toBe("daily");
    expect(grant.session.roomUrl).toBe("https://cal.daily.co/abc");
  });

  test("accepts a RealtimeKit grant", () => {
    const grant = joinGrantSchema.parse({
      ...common,
      transport: "sfu",
      provider: "realtimekit",
      session: {
        baseUrl: "https://rtk.cloudflare.com",
        meetingId: "m1",
        authToken: "t",
        hostPresetName: "host",
      },
    });
    expect(grant.provider).toBe("realtimekit");
  });

  test("accepts a loopback grant without a provider", () => {
    expect(joinGrantSchema.parse({ ...common, transport: "loopback" }).transport).toBe("loopback");
  });

  test("rejects a provider/session mismatch and a loopback grant claiming a vendor", () => {
    expect(
      joinGrantSchema.safeParse({
        ...common,
        transport: "sfu",
        provider: "daily",
        session: { baseUrl: "https://x", meetingId: "m", authToken: "t", hostPresetName: "h" },
      }).success
    ).toBe(false);
    expect(
      joinGrantSchema.safeParse({
        ...common,
        transport: "loopback",
        provider: "daily",
        session: { roomUrl: "https://x", meetingToken: "t" },
      }).success
    ).toBe(false);
  });
});
