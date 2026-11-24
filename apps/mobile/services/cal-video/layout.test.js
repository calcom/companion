const { gridColumns, resolveStage, sharerOrder } = require("./layout");

const participant = (id, overrides = {}) => ({
  id,
  identityId: id,
  displayName: id,
  avatarUrl: null,
  isLocal: false,
  role: "participant",
  hasAudio: true,
  hasVideo: true,
  isScreenSharing: false,
  isSpeaking: null,
  connection: null,
  handRaisedAt: null,
  screenShareStartedAt: null,
  ...overrides,
});

const me = participant("me", { isLocal: true });

describe("sharerOrder", () => {
  test("newest share first", () => {
    const order = sharerOrder([
      participant("a", { isScreenSharing: true, screenShareStartedAt: 100 }),
      participant("b", { isScreenSharing: true, screenShareStartedAt: 200 }),
      participant("c"),
    ]);
    expect(order.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("resolveStage", () => {
  test("auto with nothing pinned or shared is a plain grid", () => {
    const layout = resolveStage({
      choice: "auto",
      participants: [me, participant("a"), participant("b")],
      pinnedIds: [],
      dominantSpeakerId: "a",
    });
    expect(layout.staged).toBeNull();
    expect(layout.strip.map((p) => p.id)).toEqual(["me", "a", "b"]);
  });

  test("a share beats a pin and keeps the sharer's face in the strip", () => {
    const layout = resolveStage({
      choice: "auto",
      participants: [me, participant("a", { isScreenSharing: true }), participant("b")],
      pinnedIds: ["b"],
      dominantSpeakerId: null,
    });
    expect(layout.staged).toMatchObject({ kind: "screen", participant: { id: "a" } });
    expect(layout.strip.map((p) => p.id)).toEqual(["me", "a", "b"]);
  });

  test("a pin beats the speaker and leaves the strip", () => {
    const layout = resolveStage({
      choice: "speaker",
      participants: [me, participant("a"), participant("b")],
      pinnedIds: ["b"],
      dominantSpeakerId: "a",
    });
    expect(layout.staged).toMatchObject({ kind: "pin", participant: { id: "b" } });
    expect(layout.strip.map((p) => p.id)).toEqual(["me", "a"]);
  });

  test("speaker follows the dominant speaker, then the previous holder, never you", () => {
    const people = [me, participant("a"), participant("b")];
    expect(
      resolveStage({
        choice: "speaker",
        participants: people,
        pinnedIds: [],
        dominantSpeakerId: "b",
      }).staged
    ).toMatchObject({ kind: "speaker", participant: { id: "b" } });
    expect(
      resolveStage({
        choice: "speaker",
        participants: people,
        pinnedIds: [],
        dominantSpeakerId: null,
        previousSpeakerId: "b",
      }).staged
    ).toMatchObject({ kind: "speaker", participant: { id: "b" } });
    expect(
      resolveStage({
        choice: "speaker",
        participants: people,
        pinnedIds: [],
        dominantSpeakerId: "me",
      }).staged
    ).toMatchObject({ kind: "speaker", participant: { id: "a" } });
    expect(
      resolveStage({
        choice: "speaker",
        participants: [me],
        pinnedIds: [],
        dominantSpeakerId: null,
      }).staged
    ).toBeNull();
  });
});

describe("gridColumns", () => {
  test("one column alone, two otherwise", () => {
    expect(gridColumns(1)).toBe(1);
    expect(gridColumns(2)).toBe(2);
    expect(gridColumns(7)).toBe(2);
  });
});
