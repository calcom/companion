import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_KEY = "a".repeat(64);

// Mock @vercel/postgres before importing modules that use it
const mockRows: Record<string, unknown>[] = [];
let mockSql: ReturnType<typeof vi.fn>;

vi.mock("@vercel/postgres", () => {
  mockSql = vi.fn(async () => ({ rows: mockRows, rowCount: mockRows.length }));
  const client = { sql: mockSql, release: vi.fn() };
  const pool = {
    sql: mockSql,
    connect: vi.fn(async () => client),
    end: vi.fn(),
  };
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
    const client = await tokenStore.createRegisteredClient(
      ["http://localhost:3000/callback"],
      "Test Client"
    );

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
      clientId: "test-id",
      redirectUris: JSON.stringify(["http://localhost/cb"]),
      clientName: "Test",
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
      clientId: "client-1",
      clientRedirectUri: "http://localhost/cb",
      clientState: "client-state-abc",
      clientCodeChallenge: "challenge-xyz",
      calCodeVerifier: "verifier-123",
      expiresAt: Math.floor(Date.now() / 1000) + 600,
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
      clientId: "c",
      clientRedirectUri: "http://localhost/cb",
      clientState: "cs",
      clientCodeChallenge: "cc",
      calCodeVerifier: null,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
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
      clientId: "client-1",
      redirectUri: "http://localhost/cb",
      codeChallenge: "cc",
      calAccessTokenEnc: encrypt("cal-access-token"),
      calRefreshTokenEnc: encrypt("cal-refresh-token"),
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    });

    const consumed = await tokenStore.consumeAuthCode("test-code");
    expect(consumed).toBeDefined();
    expect(consumed?.clientId).toBe("client-1");
    expect(consumed?.calAccessToken).toBe("cal-access-token");
    expect(consumed?.calRefreshToken).toBe("cal-refresh-token");
    // Single atomic UPDATE...RETURNING
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when code not found", async () => {
    const result = await tokenStore.consumeAuthCode("nonexistent");
    expect(result).toBeUndefined();
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
      refreshToken: "test-refresh",
      clientId: "client-1",
      calAccessTokenEnc: encrypt("cal-at"),
      calRefreshTokenEnc: encrypt("cal-rt"),
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
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
      refreshToken: "test-refresh",
      clientId: "client-1",
      calAccessTokenEnc: encrypt("cal-at"),
      calRefreshTokenEnc: encrypt("cal-rt"),
      calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const record = await tokenStore.getAccessTokenByRefresh("test-refresh");
    expect(record).toBeDefined();
    expect(record?.token).toBe("test-token");
    expect(String(mockSql.mock.calls[0]?.[0])).toContain("refreshExpiresAt");
  });

  it("deletes an access token", async () => {
    await tokenStore.deleteAccessToken("test-token");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("rotates MCP wrapper tokens with one atomic update", async () => {
    mockSql.mockResolvedValueOnce({ rows: [{ token: "new-token" }], rowCount: 1 });
    const rotated = await tokenStore.rotateAccessToken("old-refresh");
    expect(rotated).toBeDefined();
    expect(rotated?.accessToken).toBeTruthy();
    expect(rotated?.refreshToken).toBeTruthy();
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(String(mockSql.mock.calls[0]?.[0])).toContain("refreshLeaseUntil");
    expect(String(mockSql.mock.calls[0]?.[0])).toContain("refreshExpiresAt");
  });

  it("returns undefined when rotating unknown refresh token", async () => {
    const result = await tokenStore.rotateAccessToken("nonexistent");
    expect(result).toBeUndefined();
  });

  it("waits for a configured long refresh lease before rotating", async () => {
    const { encrypt } = await import("./encryption.js");
    const previousTimeout = process.env.TOKEN_FETCH_TIMEOUT_MS;
    process.env.TOKEN_FETCH_TIMEOUT_MS = "55000";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2033-05-18T03:33:20.000Z"));
    const leaseUntil = Math.floor(Date.now() / 1000) + 60;
    const existingRow = {
      token: "old-token",
      refreshToken: "old-refresh",
      clientId: "client-1",
      calAccessTokenEnc: encrypt("cal-at"),
      calRefreshTokenEnc: encrypt("cal-rt"),
      calTokenExpiresAt: Math.floor(Date.now() / 1000) - 1,
      calTokenVersion: 0,
      calTokenInvalidAt: null,
      refreshLeaseId: "active-lease",
      refreshLeaseUntil: leaseUntil,
      expiresAt: Math.floor(Date.now() / 1000) - 1,
      refreshExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = String(strings);
      if (query.includes('SET "token" =')) {
        return Date.now() >= leaseUntil * 1000
          ? { rows: [{ token: "new-token" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      return { rows: [existingRow], rowCount: 1 };
    });

    try {
      const rotation = tokenStore.rotateAccessToken("old-refresh");
      await vi.advanceTimersByTimeAsync(60_100);

      await expect(rotation).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
      if (previousTimeout === undefined) delete process.env.TOKEN_FETCH_TIMEOUT_MS;
      else process.env.TOKEN_FETCH_TIMEOUT_MS = previousTimeout;
      mockSql.mockImplementation(async () => ({ rows: mockRows, rowCount: mockRows.length }));
    }
  });

  it("claims an expiring Cal.com token with a short atomic update", async () => {
    const { encrypt } = await import("./encryption.js");
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          token: "token",
          refreshToken: "mcp-refresh",
          clientId: "client-1",
          calAccessTokenEnc: encrypt("old-cal-at"),
          calRefreshTokenEnc: encrypt("old-cal-rt"),
          calTokenExpiresAt: 1,
          calTokenVersion: 3,
          refreshLeaseId: "claimed-lease",
          refreshLeaseUntil: 9999999999,
          expiresAt: 9999999999,
        },
      ],
      rowCount: 1,
    });

    const result = await tokenStore.claimCalTokenRefresh("token", 15);

    expect(result.status).toBe("claimed");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("persists refreshed tokens with lease and version fencing", async () => {
    const { encrypt } = await import("./encryption.js");
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          token: "token",
          refreshToken: "mcp-refresh",
          clientId: "client-1",
          calAccessTokenEnc: encrypt("new-cal-at"),
          calRefreshTokenEnc: encrypt("new-cal-rt"),
          calTokenExpiresAt: 999,
          calTokenVersion: 4,
          expiresAt: 9999999999,
        },
      ],
      rowCount: 1,
    });

    const result = await tokenStore.persistCalTokenRefresh("token", "lease", 3, {
      calAccessToken: "new-cal-at",
      calRefreshToken: "new-cal-rt",
      calTokenExpiresAt: 999,
    });

    expect(result?.calTokenVersion).toBe(4);
    const query = String(mockSql.mock.calls[0]?.[0]);
    expect(query).toContain('"refreshLeaseId" =');
    expect(query).toContain('"calTokenVersion" =');
    expect(query).toContain('"calTokenInvalidAt" IS NULL');
  });

  it("rejects a stale fenced refresh write", async () => {
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await tokenStore.persistCalTokenRefresh("token", "stale-lease", 2, {
      calAccessToken: "stale-cal-at",
      calRefreshToken: "stale-cal-rt",
      calTokenExpiresAt: 999,
    });

    expect(result).toBeUndefined();
    const query = String(mockSql.mock.calls[0]?.[0]);
    expect(query).toContain('"refreshLeaseId" =');
    expect(query).toContain('"calTokenVersion" =');
    expect(query).toContain('"calTokenInvalidAt" IS NULL');
  });
});

describe("cleanupExpired", () => {
  it("runs cleanup queries without error", async () => {
    await tokenStore.cleanupExpired();
    // 3 DELETE queries (PendingAuth, AuthCode, AccessToken)
    expect(mockSql).toHaveBeenCalledTimes(3);
    expect(String(mockSql.mock.calls[2]?.[0])).toContain("refreshExpiresAt");
  });
});
