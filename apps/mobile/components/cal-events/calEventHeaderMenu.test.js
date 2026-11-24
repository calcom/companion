import { describe, expect, test } from "@jest/globals";

const { getCalEventHeaderMenu } = require("./calEventHeaderMenu");

const handlers = {
  onOpenPage: () => {},
  onPreview: () => {},
  onPublish: () => {},
  onCopyLink: () => {},
  onShare: () => {},
  onCancel: () => {},
};

const labels = (status, canManage) =>
  getCalEventHeaderMenu({ status }, canManage, handlers).map((item) => item.label);

describe("getCalEventHeaderMenu", () => {
  test("a draft's owner or host previews it, copies its link and publishes it", () => {
    expect(labels("draft", true)).toEqual(["Preview", "Copy link", "Publish"]);
  });

  test("a co-host gets nothing for a draft", () => {
    expect(labels("draft", false)).toEqual([]);
  });

  test("a published event's owner or host can also cancel it", () => {
    expect(labels("published", true)).toEqual([
      "View event page",
      "Copy link",
      "Share event",
      "Cancel event",
    ]);
    expect(labels("published", false)).toEqual(["View event page", "Copy link", "Share event"]);
  });

  test("a past event keeps its link and sharing, but can't be cancelled", () => {
    expect(labels("past", true)).toEqual(["View event page", "Copy link", "Share event"]);
  });

  test("a cancelled event's page opens, but its link isn't handed out", () => {
    expect(labels("cancelled", true)).toEqual(["View event page"]);
  });

  test("each item calls its own handler", () => {
    const calls = [];
    const record = (name) => () => calls.push(name);
    const menu = getCalEventHeaderMenu({ status: "published" }, true, {
      onOpenPage: record("open"),
      onPreview: record("preview"),
      onPublish: record("publish"),
      onCopyLink: record("copy"),
      onShare: record("share"),
      onCancel: record("cancel"),
    });
    for (const item of menu) item.onPress();
    expect(calls).toEqual(["open", "copy", "share", "cancel"]);
    expect(menu.find((item) => item.label === "Cancel event")?.destructive).toBe(true);
  });
});
