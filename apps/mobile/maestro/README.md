# Companion Mobile Maestro Flows

This folder contains installed-app E2E flows for the Expo mobile app.

Maestro is for critical journeys that need the running app, native navigation,
or platform behavior. Keep pure logic and component behavior in Jest.

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

## App IDs

- iOS: `com.cal.companion`
- Android: `com.calcom.companion`

## Authoring Notes

- Use Maestro MCP or `maestro hierarchy` to inspect the running screen before
  choosing selectors.
- Prefer stable ids or accessibility labels for repeated controls. Visible text
  is acceptable for stable screen copy and native dialogs.
- Do not add broad flows that duplicate Jest coverage.
- Do not make Maestro blocking in CI until the flow has a reliable simulator or
  Maestro Cloud runner with a known app binary and test data.
