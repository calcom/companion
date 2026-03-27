import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as dbModule from "./db.js";
import {
  createRegisteredClient,
  getRegisteredClient,
  createPendingAuth,
  getPendingAuth,
  deletePendingAuth,
  createAuthCode,
  consumeAuthCode,
  createAccessToken,
  getAccessToken,
  getAccessTokenByRefresh,
  rotateAccessToken,
  deleteAccessToken,
  cleanupExpired,
} from "./token-store.js";

const TEST_KEY = "a".repeat(64);
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  // Use in-memory SQLite for tests
  process.env.DATABASE_PATH = ":memory:";
  // Reset the db singleton by re-initializing
  const db = dbModule.getDb();
  // Clean all tables
  db.exec("DELETE FROM registered_clients");
  db.exec("DELETE FROM pending_auths");
  db.exec("DELETE FROM auth_codes");
  db.exec("DELETE FROM access_tokens");
});

afterEach(() => {
  dbModule.closeDb();
  process.env = originalEnv;
});

describe("registered clients", () => {
  it("creates and retrieves a client", () => {
    const client = createRegisteredClient(["http://localhost:3000/callback"], "Test Client");
    expect(client.clientId).toBeTruthy();
    expect(client.redirectUris).toEqual(["http://localhost:3000/callback"]);
    expect(client.clientName).toBe("Test Client");

    const retrieved = getRegisteredClient(client.clientId);
    expect(retrieved).toEqual(client);
  });

  it("returns undefined for unknown client", () => {
    expect(getRegisteredClient("nonexistent")).toBeUndefined();
  });
});

describe("pending auths", () => {
  it("creates and retrieves a pending auth", () => {
    createPendingAuth({
      state: "test-state",
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "client-state-abc",
      clientCodeChallenge: "challenge-xyz",
      calCodeVerifier: "verifier-123",
    });

    const auth = getPendingAuth("test-state");
    expect(auth).toBeDefined();
    expect(auth?.clientId).toBe("client-1");
    expect(auth?.clientState).toBe("client-state-abc");
    expect(auth?.calCodeVerifier).toBe("verifier-123");
  });

  it("returns undefined for expired pending auth", () => {
    createPendingAuth({
      state: "expired-state",
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "cs",
      clientCodeChallenge: "cc",
      calCodeVerifier: "cv",
      ttlSeconds: -1, // Already expired
    });

    expect(getPendingAuth("expired-state")).toBeUndefined();
  });

  it("deletes a pending auth", () => {
    createPendingAuth({
      state: "delete-me",
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "cs",
      clientCodeChallenge: "cc",
      calCodeVerifier: "cv",
    });

    deletePendingAuth("delete-me");
    expect(getPendingAuth("delete-me")).toBeUndefined();
  });
});

describe("auth codes", () => {
  it("creates and consumes an auth code", () => {
    const code = createAuthCode({
      clientId: "client-1",
      redirectUri: "http://localhost/cb",
      codeChallenge: "challenge-xyz",
      calAccessToken: "cal-access-token",
      calRefreshToken: "cal-refresh-token",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(code).toBeTruthy();

    const consumed = consumeAuthCode(code);
    expect(consumed).toBeDefined();
    expect(consumed?.clientId).toBe("client-1");
    expect(consumed?.calAccessToken).toBe("cal-access-token");
    expect(consumed?.calRefreshToken).toBe("cal-refresh-token");
  });

  it("cannot consume the same code twice", () => {
    const code = createAuthCode({
      clientId: "client-1",
      redirectUri: "http://localhost/cb",
      codeChallenge: "cc",
      calAccessToken: "at",
      calRefreshToken: "rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(consumeAuthCode(code)).toBeDefined();
    expect(consumeAuthCode(code)).toBeUndefined();
  });
});

describe("access tokens", () => {
  it("creates and retrieves an access token", () => {
    const result = createAccessToken({
      clientId: "client-1",
      calAccessToken: "cal-at",
      calRefreshToken: "cal-rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(3600);

    const record = getAccessToken(result.accessToken);
    expect(record).toBeDefined();
    expect(record?.calAccessToken).toBe("cal-at");
    expect(record?.calRefreshToken).toBe("cal-rt");
  });

  it("retrieves by refresh token", () => {
    const result = createAccessToken({
      clientId: "client-1",
      calAccessToken: "cal-at",
      calRefreshToken: "cal-rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const record = getAccessTokenByRefresh(result.refreshToken);
    expect(record).toBeDefined();
    expect(record?.token).toBe(result.accessToken);
  });

  it("deletes an access token", () => {
    const result = createAccessToken({
      clientId: "client-1",
      calAccessToken: "cal-at",
      calRefreshToken: "cal-rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    deleteAccessToken(result.accessToken);
    expect(getAccessToken(result.accessToken)).toBeUndefined();
  });

  it("rotates an access token", () => {
    const original = createAccessToken({
      clientId: "client-1",
      calAccessToken: "cal-at",
      calRefreshToken: "cal-rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const rotated = rotateAccessToken(original.refreshToken);
    expect(rotated).toBeDefined();
    expect(rotated?.accessToken).not.toBe(original.accessToken);
    expect(rotated?.refreshToken).not.toBe(original.refreshToken);

    // Old token should be gone
    expect(getAccessToken(original.accessToken)).toBeUndefined();

    // New token should work and have same Cal.com creds
    const record = getAccessToken(rotated?.accessToken ?? "");
    expect(record?.calAccessToken).toBe("cal-at");
  });

  it("returns undefined when rotating unknown refresh token", () => {
    expect(rotateAccessToken("nonexistent")).toBeUndefined();
  });
});

describe("cleanupExpired", () => {
  it("removes expired rows without error", () => {
    // Create some records that are not expired
    createPendingAuth({
      state: "valid-state",
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "cs",
      clientCodeChallenge: "cc",
      calCodeVerifier: "cv",
    });

    expect(() => cleanupExpired()).not.toThrow();

    // Valid record should still exist
    expect(getPendingAuth("valid-state")).toBeDefined();
  });
});
