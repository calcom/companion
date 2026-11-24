/**
 * Broadcast Upload Extension for Cal Video screen sharing on iOS.
 *
 * ReplayKit can only capture the screen from an app extension. The system picker that
 * RealtimeKit raises looks the extension up by the `RTCAppScreenSharingExtension` key in the main
 * app's Info.plist (see `ios.infoPlist` in app.json); the frames travel to the app over a Unix
 * socket in the shared App Group, so both sides must list the same group.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: "broadcast-upload",
  name: "ScreenShare",
  displayName: "Screen Share",
  bundleIdentifier: ".screenshare",
  deploymentTarget: "16.0",
  frameworks: ["ReplayKit"],
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
