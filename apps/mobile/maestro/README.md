# Companion Mobile Maestro Flows

This folder contains installed-app E2E flows for the Expo mobile app.

Maestro is for critical journeys that need the running app, native navigation,
or platform behavior. Keep pure logic and component behavior in Jest.

## Structure

- `config.yaml` discovers flows and excludes utility helpers from direct runs.
- `flows/` contains runnable E2E flows.
- `helpers/` contains reusable subflows tagged with `util`.

## Commands

Run syntax validation without a simulator:

```sh
bun run mobile:e2e:check
```

Run locally on iOS:

```sh
bun run mobile:e2e:ios
```

Run locally on Android:

```sh
bun run mobile:e2e:android
```

Run against a custom app id:

```sh
APP_ID=com.cal.companion bun run mobile:e2e
```

The default `mobile:e2e` script runs the Maestro folder with the app ID from
`APP_ID`, falling back to the iOS bundle ID for local convenience.

## App IDs

- iOS: `com.cal.companion`
- Android: `com.calcom.companion`

## CI

The `Mobile Maestro Android` PR check builds a release Android APK from the
generated native project, installs it on a GitHub-hosted emulator, and runs the
current smoke flows with `APP_ID=com.calcom.companion`.

The `Mobile Maestro iOS` PR check builds a simulator `.app` from the generated
Xcode workspace, installs it on a GitHub-hosted iPhone simulator, and runs the
current smoke flows with `APP_ID=com.cal.companion`.

Both jobs run `bun run mobile:e2e:check` before building so YAML syntax failures
are reported quickly. Runtime failures upload the JUnit report and Maestro
debug artifacts as `mobile-maestro-android` or `mobile-maestro-ios` workflow
artifacts.

The logged-out smoke build uses a CI-only dummy Google services file and does
not require production Firebase secrets.

## Authoring Notes

- Use Maestro MCP or `maestro hierarchy` to inspect the running screen before
  choosing selectors.
- Prefer stable ids or accessibility labels for repeated controls. Visible text
  is acceptable for stable screen copy and native dialogs.
- Keep shared flows free of platform tags. Use `ios-only` or `android-only` only
  when a flow must be skipped on the other platform.
- Do not add broad flows that duplicate Jest coverage.
- Keep blocking CI limited to reliable smoke coverage until authenticated flows
  have stable test data and an auth strategy.
