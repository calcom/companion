---
title: Use AI to Author Companion Mobile Tests Safely
impact: MEDIUM
impactDescription: Helps developers and agents generate useful tests without accepting brittle output
tags: testing, mobile, ai, jest, maestro
---

# Use AI to Author Companion Mobile Tests Safely

**Impact: MEDIUM (helps developers and agents generate useful tests without
accepting brittle output)**

Use this rule when a developer or AI agent uses prompts to generate tests for
`apps/mobile`. AI can help people who are new to Jest or Maestro, but generated
tests still need repo context, deterministic data, and verification.

## Instructions for AI agents

If you are the AI agent receiving one of these prompts:

1. Read [testing-mobile](testing-mobile.md) first, then read
   [testing-mobile-jest](testing-mobile-jest.md) or
   [testing-mobile-maestro](testing-mobile-maestro.md) based on the requested
   layer.
2. Inspect the repo context before generating tests.
3. Ask for missing secrets, devices, or seeded data only when the test cannot be
   designed without them.
4. Explain the test layer choice before writing the test.
5. Include the verification command with the generated test.
6. If the repo lacks the necessary test runner, config, or scripts, say that and
   propose the smallest setup change instead of inventing commands.
7. When generating Maestro flows, use Maestro MCP for screen inspection,
   selector discovery, flow prototyping, and debugging when it is available.
   Do not let MCP output replace repo-aware test design or code review.

## Jest prompt template

Give the agent:

- The changed file or PR diff.
- The nearest existing tests for the same area.
- The behavior that should be protected.
- Any relevant hooks, service functions, cache keys, or native modules.

```text
Write or update Jest tests for this apps/mobile change.

Context:
- Changed files: <paths or diff>
- Existing nearby tests: <paths>
- Behavior to prove: <specific user-visible or logic behavior>

Requirements:
- Use jest-expo and @testing-library/react-native patterns.
- Do not create new bun:test tests for apps/mobile.
- Do not use DOM-only React Testing Library APIs.
- Mock native modules, router boundaries, network calls, and storage explicitly.
- Prefer behavior assertions over implementation details.
- Explain why Jest is the right layer instead of Maestro.
- Include the exact command I should run to verify the test.
```

## Maestro prompt template

Give the agent:

- The user journey to cover.
- The target platform or whether the flow must run on both iOS and Android.
- The app IDs from `apps/mobile/app.json`.
- Stable text, accessibility labels, or test IDs already present.
- Any login, seed data, or backend assumptions.

```text
Write or update a Maestro flow for this apps/mobile journey.

Context:
- Journey: <start screen -> action -> expected result>
- Platform: <iOS, Android, or both>
- App IDs: iOS com.cal.companion, Android com.calcom.companion
- Existing selectors or screen text: <paste from inspect_screen when available>

Requirements:
- Keep the flow focused on one critical user journey.
- Use stable testID/accessibility selectors where available.
- Use Maestro MCP inspect_screen output when available before choosing
  selectors.
- Use visible text only for user-visible copy or native dialogs.
- Avoid index selectors unless there is no stable alternative.
- Use platform branches for native iOS/Android differences.
- Include the exact local or cloud command I should run to verify the flow.
```

## Acceptance checklist

Before accepting AI-generated tests, check:

1. The agent explained why the test belongs in Jest or Maestro.
2. The test can run deterministically without private local state.
3. Mobile unit/component tests use Jest patterns, not `bun:test`.
4. React Native tests do not import DOM-only testing utilities.
5. Maestro MCP is used only for inspection, authoring assistance, and
   debugging, not for deciding the product coverage strategy.
6. Maestro selectors are copied from code or `inspect_screen`, not guessed from
   screenshots.
7. The verification command exists in the repo or is added in the same PR.
