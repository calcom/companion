const { canPublishScreen } = require("./screen-share-support");

describe("canPublishScreen", () => {
  test("android needs nothing beyond the SDK", () => {
    expect(canPublishScreen({ platform: "android", infoPlist: null })).toBe(true);
  });

  test("ios needs the broadcast extension declared in the build", () => {
    expect(canPublishScreen({ platform: "ios", infoPlist: undefined })).toBe(false);
    expect(canPublishScreen({ platform: "ios", infoPlist: {} })).toBe(false);
    expect(
      canPublishScreen({ platform: "ios", infoPlist: { RTCAppScreenSharingExtension: "" } })
    ).toBe(false);
    expect(
      canPublishScreen({
        platform: "ios",
        infoPlist: { RTCAppScreenSharingExtension: "com.example.app.screenshare" },
      })
    ).toBe(true);
  });

  test("other platforms cannot", () => {
    expect(
      canPublishScreen({ platform: "web", infoPlist: { RTCAppScreenSharingExtension: "x" } })
    ).toBe(false);
  });
});
