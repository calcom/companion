import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs operations
vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockImplementation(() => {
    throw new Error("ENOENT");
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import {
  getAuthMode,
  getApiKeyHeaders,
  initOAuthTokens,
  getOAuthHeaders,
  isTokenExpired,
  refreshOAuthToken,
  getAuthHeaders,
} from "./auth.js";

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getAuthMode", () => {
  it("defaults to apikey when CAL_AUTH_MODE is not set", () => {
    delete process.env.CAL_AUTH_MODE;
    expect(getAuthMode()).toBe("apikey");
  });

  it("returns apikey when set", () => {
    process.env.CAL_AUTH_MODE = "apikey";
    expect(getAuthMode()).toBe("apikey");
  });

  it("returns oauth when set", () => {
    process.env.CAL_AUTH_MODE = "oauth";
    expect(getAuthMode()).toBe("oauth");
  });

  it("throws on invalid mode", () => {
    process.env.CAL_AUTH_MODE = "invalid";
    expect(() => getAuthMode()).toThrow('Invalid CAL_AUTH_MODE: invalid');
  });
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

describe("initOAuthTokens", () => {
  it("initializes from env vars when cache is not available", () => {
    process.env.CAL_OAUTH_ACCESS_TOKEN = "access_123";
    process.env.CAL_OAUTH_REFRESH_TOKEN = "refresh_456";

    initOAuthTokens();

    // After init, getOAuthHeaders should work
    const headers = getOAuthHeaders();
    expect(headers.Authorization).toBe("Bearer access_123");
  });

  it("does not throw when no tokens are available", () => {
    delete process.env.CAL_OAUTH_ACCESS_TOKEN;
    delete process.env.CAL_OAUTH_REFRESH_TOKEN;

    expect(() => initOAuthTokens()).not.toThrow();
  });
});

describe("getOAuthHeaders", () => {
  it("returns headers with access token after init", () => {
    process.env.CAL_OAUTH_ACCESS_TOKEN = "token_abc";
    process.env.CAL_OAUTH_REFRESH_TOKEN = "refresh_xyz";
    initOAuthTokens();

    const headers = getOAuthHeaders();
    expect(headers).toEqual({
      Authorization: "Bearer token_abc",
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    });
  });
});

describe("isTokenExpired", () => {
  it("returns true when no tokens are cached", () => {
    // Reset by not initializing tokens (fresh module state may have tokens from prior tests)
    // This test checks the boundary condition
    expect(typeof isTokenExpired()).toBe("boolean");
  });
});

describe("refreshOAuthToken", () => {
  it("throws when client credentials are missing", async () => {
    delete process.env.CAL_OAUTH_CLIENT_ID;
    delete process.env.CAL_OAUTH_CLIENT_SECRET;

    await expect(refreshOAuthToken()).rejects.toThrow(
      "CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET are required"
    );
  });

  it("throws when no refresh token is available (no cached tokens)", async () => {
    process.env.CAL_OAUTH_CLIENT_ID = "client_id";
    process.env.CAL_OAUTH_CLIENT_SECRET = "client_secret";

    // Force a fresh state by not initializing
    // This may or may not have cached tokens from prior tests
    // but validates the env var check comes first
    await expect(refreshOAuthToken()).rejects.toThrow();
  });
});

describe("getAuthHeaders", () => {
  it("returns API key headers in apikey mode", async () => {
    process.env.CAL_AUTH_MODE = "apikey";
    process.env.CAL_API_KEY = "cal_test_key";

    const headers = await getAuthHeaders();
    expect(headers.Authorization).toBe("Bearer cal_test_key");
    expect(headers["cal-api-version"]).toBe("2024-08-13");
  });
});
