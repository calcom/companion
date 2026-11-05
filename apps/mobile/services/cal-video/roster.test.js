const {
  filterRoster,
  participantActions,
  participantMarks,
  raisedHands,
  rosterHere,
  trustedAvatarUrl,
} = require("./roster");

const participant = (id, overrides = {}) => ({
  id,
  identityId: `identity-${id}`,
  displayName: `Person ${id}`,
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

describe("rosterHere", () => {
  test("puts you first and withholds a remove target for your own identity", () => {
    const here = rosterHere([
      participant("a"),
      participant("me", { isLocal: true, role: "host" }),
      participant("me-tab", { identityId: "identity-me" }),
    ]);
    expect(here.map((p) => p.id)).toEqual(["me", "a", "me-tab"]);
    expect(here[0].removalId).toBeNull();
    expect(here[2].removalId).toBeNull();
    expect(here[1].removalId).toBe("identity-a");
  });

  test("keeps only Cal-hosted avatars", () => {
    const here = rosterHere(
      [
        participant("a", { avatarUrl: "https://app.cal.com/avatar.png" }),
        participant("b", { avatarUrl: "https://evil.example/pixel.png" }),
      ],
      ["https://app.cal.com"]
    );
    expect(here[0].avatarUrl).toBe("https://app.cal.com/avatar.png");
    expect(here[1].avatarUrl).toBeNull();
  });
});

describe("trustedAvatarUrl", () => {
  test("refuses non-https and foreign hosts", () => {
    expect(trustedAvatarUrl("http://app.cal.com/a.png", ["https://app.cal.com"])).toBeNull();
    expect(trustedAvatarUrl("https://cdn.other.com/a.png", ["https://app.cal.com"])).toBeNull();
    expect(trustedAvatarUrl("not a url", [])).toBeNull();
  });
});

describe("raisedHands", () => {
  test("orders first raised first", () => {
    const here = rosterHere([
      participant("a", { handRaisedAt: 300 }),
      participant("b", { handRaisedAt: 100 }),
      participant("c"),
    ]);
    expect(raisedHands(here).map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("participantMarks", () => {
  test("lists marks in reading order and skips camera-off in an audio room", () => {
    const [person] = rosterHere([
      participant("a", { hasAudio: false, hasVideo: false, isScreenSharing: true }),
    ]);
    expect(participantMarks({ person, pinned: true })).toEqual([
      "pinned",
      "sharing",
      "camera-off",
      "muted",
    ]);
    expect(participantMarks({ person, pinned: false, video: false })).toEqual(["sharing", "muted"]);
  });
});

describe("participantActions", () => {
  const base = { sharedPinIds: [], localPinIds: [] };

  test("a guest only pins for themselves", () => {
    const [person] = rosterHere([participant("a")]);
    expect(participantActions({ ...base, person, canModerate: false, canRemove: false })).toEqual([
      "pin-for-me",
    ]);
  });

  test("a host gets moderation and remove, never on themselves or another host", () => {
    const here = rosterHere([
      participant("me", { isLocal: true, role: "host" }),
      participant("a", { isScreenSharing: true }),
      participant("h", { role: "host" }),
    ]);
    const [me, a, h] = here;
    expect(participantActions({ ...base, person: me, canModerate: true, canRemove: true })).toEqual(
      ["pin-for-everyone", "pin-for-me"]
    );
    expect(participantActions({ ...base, person: a, canModerate: true, canRemove: true })).toEqual([
      "pin-for-everyone",
      "pin-for-me",
      "mute",
      "stop-screen-share",
      "remove",
    ]);
    expect(
      participantActions({ ...base, person: h, canModerate: true, canRemove: true })
    ).not.toContain("remove");
  });

  test("a host with durable chat can mute a guest in chat, never another host", () => {
    const [guest, host] = rosterHere([participant("a"), participant("h", { role: "host" })]);
    const muted = new Set(["identity-a"]);
    expect(
      participantActions({
        ...base,
        person: guest,
        canModerate: false,
        canRemove: false,
        chatMutedIds: new Set(),
      })
    ).toContain("chat-mute");
    expect(
      participantActions({
        ...base,
        person: guest,
        canModerate: false,
        canRemove: false,
        chatMutedIds: muted,
      })
    ).toContain("chat-unmute");
    expect(
      participantActions({
        ...base,
        person: host,
        canModerate: false,
        canRemove: false,
        chatMutedIds: muted,
      })
    ).not.toContain("chat-mute");
  });

  test("unpin replaces pin and no pins in an audio room", () => {
    const [person] = rosterHere([participant("a")]);
    expect(
      participantActions({
        ...base,
        localPinIds: ["a"],
        person,
        canModerate: false,
        canRemove: false,
      })
    ).toEqual(["unpin-for-me"]);
    expect(
      participantActions({ ...base, person, canModerate: false, canRemove: false, canPin: false })
    ).toEqual([]);
  });
});

describe("filterRoster", () => {
  test("matches without case or accents", () => {
    const people = [{ displayName: "Renée" }, { displayName: "Bob" }];
    expect(filterRoster(people, "ren")).toEqual([{ displayName: "Renée" }]);
    expect(filterRoster(people, "")).toHaveLength(2);
  });
});
