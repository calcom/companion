---
title: Write Companion Mobile Jest Tests with Expo and React Native Testing Library
impact: HIGH
impactDescription: Keeps mobile logic and component behavior covered by fast deterministic tests
tags: testing, mobile, expo, react-native, jest, jest-expo
---

# Write Companion Mobile Jest Tests with Expo and React Native Testing Library

**Impact: HIGH (keeps mobile logic and component behavior covered by fast
deterministic tests)**

Use this rule when adding or updating unit and component tests for `apps/mobile`.
Expo's documented unit-test path is **Jest with `jest-expo`**. Component tests
should use **`@testing-library/react-native`**, not DOM-focused
`@testing-library/react`.

Jest is the target runner for mobile unit/component tests. Bun is still the repo
package manager, but agents must not create new `bun:test` mobile tests. If a
mobile area still has `bun:test` coverage, migrate that coverage to Jest when
working on the Jest foundation or call out the migration gap explicitly.

## Agent checklist

Before writing Jest tests:

1. Inspect `apps/mobile/package.json` and nearby test files. Do not assume the
   Jest runner, config, or scripts exist until they are present in the repo.
2. Find the smallest behavior that needs protection.
3. Prefer a pure function test when the behavior is logic-only.
4. Use React Native Testing Library only when rendering the component adds real
   confidence.
5. Mock native modules, storage, router boundaries, network calls, and time
   explicitly.
6. Run the exact verification command for the changed tests. If the command does
   not exist yet, add it in the same PR or report that setup is missing.

When setting up the Jest foundation, convert the existing high-value mobile
`bun:test` files instead of preserving a long-term second runner. A temporary
dual-runner state is acceptable only as an explicit migration step.

## What belongs in Jest

Prefer Jest for:

- Pure logic, formatting, date math, validation, filtering, and parser helpers.
- API payload construction and response normalization.
- React Query cache updates, mutation side effects, and optimistic UI logic.
- Booking action visibility or enablement rules.
- Component behavior that can be rendered with React Native Testing Library.

Do not push these cases into Maestro unless the behavior only appears in the
installed app or depends on real navigation/native controls.

## React Native Testing Library expectations

When adding component tests:

1. Put tests near the code they cover unless a local pattern says otherwise.
2. Prefer user-observable behavior over internal state or implementation details.
3. Query components by role, label, text, or test ID in that order.
4. Use `userEvent` or React Native Testing Library interactions for user actions.
5. Clear mocks between tests so one test cannot leak state into another.
6. Keep snapshots small; avoid large UI snapshots as the main proof.

**Incorrect (tests implementation details and browser-only tooling):**

```typescript
import { render, screen } from "@testing-library/react";

expect(component.state.isSaving).toBe(false);
expect(screen.getByTestId("save-button")).toBeInTheDocument();
```

**Correct (tests React Native behavior through accessible UI):**

```typescript
import { render, screen, userEvent } from "@testing-library/react-native";

const user = userEvent.setup();
render(<SaveButton onSave={onSave} />);

await user.press(screen.getByRole("button", { name: "Save" }));

expect(onSave).toHaveBeenCalledTimes(1);
```

## Mocking expectations

Mock only what crosses the test boundary:

- Native modules such as SecureStore, notifications, haptics, web browser, and
  platform APIs.
- Expo Router/navigation boundaries when the test is not about routing itself.
- Network calls and Cal.com API services.
- Async storage, query persistence, and time-sensitive behavior.

Avoid mocks that replace the component under test with a simpler fake surface.
If a component is hard to test without broad mocks, first look for extractable
logic that can be covered by a pure Jest test.
