---
title: Choose the Right Test Layer for Companion Mobile Changes
impact: HIGH
impactDescription: Routes mobile changes to the right Jest, Maestro, or documentation workflow
tags: testing, mobile, expo, react-native, jest, maestro, ci
---

# Choose the Right Test Layer for Companion Mobile Changes

**Impact: HIGH (routes mobile changes to the right Jest, Maestro, or
documentation workflow)**

`apps/mobile` is the Expo React Native app for iOS and Android. When changing
mobile behavior, agents must choose the smallest test layer that proves the
behavior and keeps PR checks reliable.

For unit and component tests, the long-term target is **Jest only**. Bun remains
the repo package manager and script runner, but `bun:test` should not be the
mobile test framework once the Jest foundation exists.

This is the entrypoint rule. Read the detailed rule that matches the work:

- [testing-mobile-jest](testing-mobile-jest.md) for unit and component tests.
- [testing-mobile-maestro](testing-mobile-maestro.md) for installed-app E2E
  flows.
- [testing-mobile-ai-authoring](testing-mobile-ai-authoring.md) when a human or
  AI agent is using prompts to generate mobile tests.

## Agent operating procedure

When this rule applies, the agent must do this before writing or changing tests:

1. Inspect the changed `apps/mobile` files, nearby tests, and relevant package
   scripts/config. Do not assume Jest or Maestro is already wired unless the repo
   contains the runner, config, and scripts.
2. Classify the behavior as logic, component behavior, navigation/user journey,
   platform-specific native behavior, or CI/test infrastructure.
3. Choose Jest or Maestro using the rules below and state the reason in the PR
   summary or final response.
4. Add the smallest test that protects the behavior. Do not create broad
   coverage matrices, new runbooks, or E2E suites unless the task asks for them.
5. Run the exact verification command for the changed tests. If verification
   cannot run because setup, credentials, devices, or CI infrastructure are
   missing, say exactly what is missing.

## Test infrastructure direction

When changing mobile test infrastructure:

- Use `jest`, `jest-expo`, and `@testing-library/react-native` for
  unit/component tests.
- Do not add new `bun:test` tests under `apps/mobile`.
- If existing `bun:test` mobile tests are present, migrate them to Jest as part
  of the Jest foundation work or explicitly call out any short-lived migration
  gap. Do not leave mobile Bun tests silently outside the PR-blocking path.
- The first Jest foundation PR should prove at least one Jest test runs locally.
- A CI PR should make the mobile Jest script blocking only after the script,
  config, and first representative tests are stable.

## Choose the right layer

Prefer Jest for:

- Pure logic, formatting, date math, validation, filtering, and parser helpers.
- API payload construction and response normalization.
- React Query cache updates, mutation side effects, and optimistic UI logic.
- Booking action visibility or enablement rules.
- Component behavior that can be rendered with React Native Testing Library.

Prefer Maestro for:

- App launch, authentication/session readiness, and tab navigation.
- Cross-screen flows such as Bookings list -> detail -> action sheet.
- Event type, availability, and settings journeys that depend on navigation,
  native controls, or installed app behavior.
- iOS/Android parity checks where platform-specific files or native UI are used.

Do not add Maestro flows for tiny edge cases that Jest can prove faster and more
deterministically. Broad E2E suites become slow and flaky when they duplicate
logic-level tests.

## Required PR behavior

When a mobile PR changes behavior:

1. Add or update Jest tests for logic and component behavior. Follow
   [testing-mobile-jest](testing-mobile-jest.md).
2. Add or update Maestro only when the change affects a critical user journey.
   Follow [testing-mobile-maestro](testing-mobile-maestro.md).
3. Explain in the PR when a behavior change does not need Maestro coverage.
4. Keep iOS and Android coverage in mind, especially when touching `.ios.tsx`,
   `.android.tsx`, native modules, widgets, notifications, or deep links.

When returning work, include:

- The test layer chosen and why.
- The files changed.
- The verification command and result.
- If no test was added for a mobile behavior change, the reason.

The goal is not maximum test count. The goal is high-confidence, blocking checks
that developers trust enough to keep enabled on every PR.
