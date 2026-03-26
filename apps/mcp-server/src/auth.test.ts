import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getApiKeyHeaders } from "./auth.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getApiKeyHeaders", () => {
  it("returns correct headers with API key", () => {
    process.env.CAL_API_KEY = "cal_test_abc123";
    const headers = getApiKeyHeaders();
    expect(headers).toEqual({
      Authorization: "Bearer cal_test_abc123",
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    });
  });

  it("throws when CAL_API_KEY is missing", () => {
    delete process.env.CAL_API_KEY;
    expect(() => getApiKeyHeaders()).toThrow("CAL_API_KEY is required");
  });
});
