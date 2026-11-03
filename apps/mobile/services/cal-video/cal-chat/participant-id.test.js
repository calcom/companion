const { createHash } = require("node:crypto");

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm, value) =>
    require("node:crypto").createHash("sha256").update(value).digest("hex"),
}));

const { chatParticipantIdFromDigest, toCalChatParticipantId } = require("./participant-id");

describe("toCalChatParticipantId", () => {
  test("a UUID passes through lower-cased", async () => {
    await expect(toCalChatParticipantId("6F9619FF-8B86-D011-B42D-00C04FC964FF")).resolves.toBe(
      "6f9619ff-8b86-d011-b42d-00c04fc964ff"
    );
  });

  test("a derived id becomes the server's stable UUID", async () => {
    const hex = createHash("sha256").update("cal-video-chat-participant:abc123").digest("hex");
    const expected = chatParticipantIdFromDigest(hex);
    await expect(toCalChatParticipantId("abc123")).resolves.toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
