import { describe, expect, test } from "@jest/globals";

const { holdsPreview, resolveRoomScreen } = require("./room-screen");

const base = {
  failure: null,
  sessionEnd: null,
  callStatus: "idle",
  hasGrant: false,
  knock: { status: "idle" },
};

describe("resolveRoomScreen", () => {
  test("shows the pre-join form before a grant", () => {
    expect(resolveRoomScreen(base)).toEqual({ kind: "prejoin" });
    expect(holdsPreview(resolveRoomScreen(base))).toBe(true);
  });

  test("shows the call once a grant exists", () => {
    expect(resolveRoomScreen({ ...base, hasGrant: true, callStatus: "joining" })).toEqual({
      kind: "call",
    });
  });

  test("a knock waits only while there is no grant", () => {
    const knock = { status: "waiting", until: 1 };
    expect(resolveRoomScreen({ ...base, knock })).toEqual({ kind: "knock", state: knock });
    expect(resolveRoomScreen({ ...base, knock, hasGrant: true })).toEqual({ kind: "call" });
    expect(resolveRoomScreen({ ...base, knock: { status: "open" } })).toEqual({ kind: "prejoin" });
  });

  test("an ending beats a leftover knock, and the driver's ending counts too", () => {
    expect(
      resolveRoomScreen({ ...base, sessionEnd: "left", knock: { status: "admitted", ticket: "t" } })
    ).toEqual({ kind: "ended", status: "left" });
    expect(resolveRoomScreen({ ...base, hasGrant: true, callStatus: "removed" })).toEqual({
      kind: "ended",
      status: "removed",
    });
  });

  test("failures win over everything", () => {
    expect(resolveRoomScreen({ ...base, failure: "not-found", hasGrant: true })).toEqual({
      kind: "failure",
      failure: "not-found",
    });
    expect(resolveRoomScreen({ ...base, hasGrant: true, callStatus: "error" })).toEqual({
      kind: "failure",
      failure: "disconnected",
    });
  });
});
