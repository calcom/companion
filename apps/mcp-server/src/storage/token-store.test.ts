import { describe, it, expect, beforeEach, vi } from "vitest";

const TEST_KEY = "a".repeat(64);

// Mock @vercel/postgres before importing modules that use it
const mockRows: Record<string, unknown>[] = [];
let mockSql: ReturnType<typeof vi.fn>;

vi.mock("@vercel/postgres", () => {
  mockSql = vi.fn(async () => ({ rows: mockRows, rowCount: mockRows.length }));
  const pool = { sql: mockSql, end: vi.fn() };
  return {
    createPool: () => pool,
    sql: mockSql,
    db: pool,
  };
});

// Set encryption key before imports
process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;

const tokenStore = await import("./token-store.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockRows.length = 0;
});

describe("registered clients", () => {
  it("creates a client with correct SQL", async () => {
    const client = await tokenStore.createRegisteredClient(["http://localhost:3000/callback"], "Test Client");

    expect(client.clientId).toBeTruthy();
    expect(client.redirectUris).toEqual(["http://localhost:3000/callback"]);
    expect(client.clientName).toBe("Test Client");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns undefined for unknown client", async () => {
    // mockRows is empty by default
    const result = await tokenStore.getRegisteredClient("nonexistent");
    expect(result).toBeUndefined();
  });

  it("retrieves a client when rows are returned", async () => {
    mockRows.push({
      client_id: "test-id",
      redirect_uris: JSON.stringify(["http://localhost/cb"]),
      client_name: "Test",
    });

    const result = await tokenStore.getRegisteredClient("test-id");
    expect(result).toEqual({
      clientId: "test-id",
      redirectUris: ["http://localhost/cb"],
      clientName: "Test",
    });
  });

  it("counts registered clients", async () => {
    mockRows.push({ count: 5 });
    const count = await tokenStore.countRegisteredClients();
    expect(count).toBe(5);
  });
});

describe("pending auths", () => {
  it("creates a pending auth", async () => {
    await tokenStore.createPendingAuth({
      state: "test-state",
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "client-state-abc",
      clientCodeChallenge: "challenge-xyz",
      calCodeVerifier: "verifier-123",
    });

    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("retrieves a pending auth", async () => {
    mockRows.push({
      state: "test-state",
      client_id: "client-1",
      client_redirect_uri: "http://localhost/cb",
      client_state: "client-state-abc",
      client_code_challenge: "challenge-xyz",
      cal_code_verifier: "verifier-123",
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });

    const auth = await tokenStore.getPendingAuth("test-state");
    expect(auth).toBeDefined();
    expect(auth?.clientId).toBe("client-1");
    expect(auth?.clientState).toBe("client-state-abc");
    expect(auth?.calCodeVerifier).toBe("verifier-123");
  });

  it("returns undefined when no rows", async () => {
    const result = await tokenStore.getPendingAuth("nonexistent");
    expect(result).toBeUndefined();
  });

  it("handles null calCodeVerifier", async () => {
    mockRows.push({
      state: "s",
      client_id: "c",
      client_redirect_uri: "http://localhost/cb",
      client_state: "cs",
      client_code_challenge: "cc",
      cal_code_verifier: null,
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });

    const auth = await tokenStore.getPendingAuth("s");
    expect(auth?.calCodeVerifier).toBeUndefined();
  });

  it("deletes a pending auth", async () => {
    await tokenStore.deletePendingAuth("delete-me");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe("auth codes", () => {
  it("creates an auth code", async () => {
    const code = await tokenStore.createAuthCode({
      clientId: "client-1",
      redirectUri: "http://localhost/cb",
      codeChallenge: "challenge-xyz",
      calAccessToken: "cal-access-token",
      calRefreshToken: "cal-refresh-token",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(code).toBeTruthy();
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("consumes an auth code", async () => {
    const { encrypt } = await import("./encryption.js");
    mockRows.push({
      code: "test-code",
      client_id: "client-1",
      redirect_uri: "http://localhost/cb",
      code_challenge: "cc",
      cal_access_token_enc: encrypt("cal-access-token"),
      cal_refresh_token_enc: encrypt("cal-refresh-token"),
      cal_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });

    const consumed = await tokenStore.consumeAuthCode("test-code");
    expect(consumed).toBeDefined();
    expect(consumed?.clientId).toBe("client-1");
    expect(consumed?.calAccessToken).toBe("cal-access-token");
    expect(consumed?.calRefreshToken).toBe("cal-refresh-token");
    // SELECT + UPDATE
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns undefined when code not found", async () => {
    const result = await tokenStore.consumeAuthCode("nonexistent");
    expect(result).toBeUndefined();
    // Only the SELECT query
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe("access tokens", () => {
  it("creates an access token", async () => {
    const result = await tokenStore.createAccessToken({
      clientId: "client-1",
      calAccessToken: "cal-at",
      calRefreshToken: "cal-rt",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(3600);
  });

  it("retrieves an access token", async () => {
    const { encrypt } = await import("./encryption.js");
    mockRows.push({
      token: "test-token",
      refresh_token: "test-refresh",
      client_id: "client-1",
      cal_access_token_enc: encrypt("cal-at"),
      cal_refresh_token_enc: encrypt("cal-rt"),
      cal_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    const record = await tokenStore.getAccessToken("test-token");
    expect(record).toBeDefined();
    expect(record?.calAccessToken).toBe("cal-at");
    expect(record?.calRefreshToken).toBe("cal-rt");
  });

  it("retrieves by refresh token", async () => {
    const { encrypt } = await import("./encryption.js");
    mockRows.push({
      token: "test-token",
      refresh_token: "test-refresh",
      client_id: "client-1",
      cal_access_token_enc: encrypt("cal-at"),
      cal_refresh_token_enc: encrypt("cal-rt"),
      cal_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    const record = await tokenStore.getAccessTokenByRefresh("test-refresh");
    expect(record).toBeDefined();
    expect(record?.token).toBe("test-token");
  });

  it("deletes an access token", async () => {
    await tokenStore.deleteAccessToken("test-token");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("rotates an access token", async () => {
    const { encrypt } = await import("./encryption.js");

    // First call: getAccessTokenByRefresh SELECT
    mockSql.mockResolvedValueOnce({
      rows: [{
        token: "old-token",
        refresh_token: "old-refresh",
        client_id: "client-1",
        cal_access_token_enc: encrypt("cal-at"),
        cal_refresh_token_enc: encrypt("cal-rt"),
        cal_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }],
      rowCount: 1,
    });
    // BEGIN
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // DELETE
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // INSERT
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // COMMIT
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const rotated = await tokenStore.rotateAccessToken("old-refresh");
    expect(rotated).toBeDefined();
    expect(rotated?.accessToken).toBeTruthy();
    expect(rotated?.refreshToken).toBeTruthy();
    // getAccessTokenByRefresh + BEGIN + DELETE + INSERT + COMMIT
    expect(mockSql).toHaveBeenCalledTimes(5);
  });

  it("returns undefined when rotating unknown refresh token", async () => {
    const result = await tokenStore.rotateAccessToken("nonexistent");
    expect(result).toBeUndefined();
  });

  it("updates Cal.com tokens", async () => {
    await tokenStore.updateCalTokens("token", "new-cal-at", "new-cal-rt", 999);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe("cleanupExpired", () => {
  it("runs cleanup queries without error", async () => {
    await tokenStore.cleanupExpired();
    // 3 DELETE queries (pending_auths, auth_codes, access_tokens)
    expect(mockSql).toHaveBeenCalledTimes(3);
  });
});
