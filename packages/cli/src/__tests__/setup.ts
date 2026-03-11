import { afterEach, vi } from "vitest";

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
