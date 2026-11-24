# ScreenShare (Broadcast Upload Extension)

iOS lets an app capture the screen only through a ReplayKit Broadcast Upload Extension. This
target is that extension for Cal Video calls.

- `SampleHandler.swift` is ours: the principal class, which hands off to RealtimeKit's handler.
- `RTK*.swift` are vendored verbatim from `@cloudflare/realtimekit-react-native/ios/screenshare`.
  An app extension cannot link the React Native pod, so the files are compiled into the
  extension directly. Re-sync after upgrading the package:

  ```sh
  bun run sync:screenshare
  ```

- `Info.plist` and `generated.entitlements` are produced by `@bacons/apple-targets` at
  `npx expo prebuild`; the App Group comes from `ios.entitlements` in `app.json`.

The main app declares the extension in `app.json` → `ios.infoPlist`:

| Key                            | Value                           |
| ------------------------------ | ------------------------------- |
| `RTCAppGroupIdentifier`        | `group.com.cal.companion`       |
| `RTCAppScreenSharingExtension` | `com.cal.companion.screenshare` |

The call UI shows "Share screen" on iOS only when `RTCAppScreenSharingExtension` is present in
the build's config (`services/cal-video/screen-share-support.ts`).

Simulators cannot run broadcast extensions; test on a device.
