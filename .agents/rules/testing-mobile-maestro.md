---
title: Write Companion Mobile Maestro E2E Flows
impact: HIGH
impactDescription: Keeps critical installed-app journeys stable across iOS and Android
tags: testing, mobile, expo, react-native, maestro, e2e
---

# Write Companion Mobile Maestro E2E Flows

**Impact: HIGH (keeps critical installed-app journeys stable across iOS and
Android)**

Use this rule when adding or updating Maestro flows for `apps/mobile`. Maestro
should cover critical user journeys in the installed app, not every logic branch
that Jest can prove faster.

## Agent checklist

Before writing Maestro flows:

1. Inspect `apps/mobile/app.json`, existing flow files, and run scripts. Do not
   assume Maestro is wired until the repo contains the flow folder and scripts.
2. Use the Maestro MCP server's `inspect_screen` tool, when available, or
   code-level `testID`/accessibility labels for selectors. Do not guess
   selectors from screenshots.
3. Decide whether the flow must run on iOS, Android, or both.
4. Keep the flow focused on one critical journey.
5. Use platform branches for real native differences.
6. Run the exact local or cloud verification command. If a simulator, emulator,
   app binary, seed data, or cloud credential is missing, report that blocker.

## Using Maestro MCP

Use the Maestro MCP server as an authoring and debugging assistant, not as the
source of product test strategy.

Prefer Maestro MCP for:

- Inspecting the current screen hierarchy before choosing selectors.
- Copying exact visible text, accessibility labels, and IDs from the running
  app.
- Prototyping a focused YAML flow against a simulator or emulator.
- Validating flow syntax and reproducing failures locally.
- Debugging iOS/Android selector or native-dialog differences.

Do not use Maestro MCP to invent broad E2E coverage, guess app state, choose
business-critical journeys without repo context, or accept generated YAML
without code review.

## Learning references

Use Maestro's official examples overview when a flow needs a pattern that is not
obvious from the command reference: https://docs.maestro.dev/examples.

The examples are useful for learning patterns such as native Android system
interactions, onboarding forms, nested flows, scrolling, clipboard checks, and
JavaScript helpers. Do not copy app-specific example flows into Companion.
Translate only the relevant pattern into a small, deterministic flow for
`apps/mobile`.

## What belongs in Maestro

Prefer Maestro for:

- App launch, authentication/session readiness, and tab navigation.
- Cross-screen flows such as Bookings list -> detail -> action sheet.
- Event type, availability, and settings journeys that depend on navigation,
  native controls, or installed app behavior.
- iOS/Android parity checks where platform-specific files or native UI are used.

Do not add Maestro flows for tiny edge cases that Jest can prove faster and more
deterministically.

## App IDs and deep links

Use the app IDs from `apps/mobile/app.json`:

- iOS bundle ID: `com.cal.companion`.
- Android package: `com.calcom.companion`.

For cross-platform flows, prefer passing the app ID through the runner:

```yaml
appId: ${APP_ID}
---
- launchApp
```

Deep links should use app schemes from `apps/mobile/app.json`, such as
`calcom://...` or `expo-wxt-app://...`, not the bundle ID or package name.

## Selector expectations

Prefer stable `testID` or accessibility selectors for repeated app elements. Use
visible text for native dialogs because app-level test IDs cannot target system
UI. Avoid index selectors unless there is no stable alternative.

If a critical flow needs a stable selector and the app does not expose one, add
a `testID` or accessibility label in app code instead of using a fragile
text/index selector. Add these hooks for repeated controls or critical journey
steps, not random one-off edge cases.

When selector syntax is unclear, check Maestro's official selector reference:
https://docs.maestro.dev/reference/selectors. Use it for supported selector
types and composition rules; still prefer selectors copied from code or
`inspect_screen` over guessed values.

**Incorrect (fragile index selector and platform assumption):**

```yaml
appId: com.cal.companion
---
- launchApp
- tapOn:
    text: "Edit"
    index: 1
```

**Correct (stable selector supplied by app code or screen inspection):**

```yaml
appId: ${APP_ID}
---
- launchApp
- tapOn:
    id: "booking-actions-button"
```

## iOS and Android gotchas

Mobile E2E tests must account for native storage and routing behavior:

- `launchApp.clearState` does not clear iOS Keychain data. Tokens stored through
  SecureStore can survive app state resets, so do not assume iOS starts logged
  out after `clearState`.
- Add or use an auth/session-ready marker before Maestro interacts with
  authenticated tabs. Cold starts can render after the test runner is ready.
- Use `runFlow.when.platform` for iOS/Android differences instead of pretending
  native controls behave identically.
- Tests that depend on server data need deterministic seed data, a stable test
  account, or a mock API. Do not rely on whatever data happens to exist locally.
- Upload screenshots, videos, or logs from CI when a flow fails.
