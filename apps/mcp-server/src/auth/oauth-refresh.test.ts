import { beforeEach, describe, expect, it, vi } from "vitest";

type RecordState = import("../storage/token-store.js").AccessTokenRecord;

const mocks = vi.hoisted(() => {
  const state = {
    record: undefined as RecordState | undefined,
    leaseCounter: 0,
  };

  const getAccessToken = vi.fn(async () => state.record && { ...state.record });
  const claimCalTokenRefresh = vi.fn(async () => {
    const record = state.record;
    if (!record || record.calTokenInvalidAt !== undefined) return { status: "invalid" as const };
    const now = Math.floor(Date.now() / 1000);
    if (record.calTokenExpiresAt > now + 60) return { status: "ready" as const, record };
    if (record.refreshLeaseId && (record.refreshLeaseUntil ?? 0) > now) {
      return { status: "waiting" as const, leaseUntil: record.refreshLeaseUntil ?? now };
    }
    const leaseId = `lease-${++state.leaseCounter}`;
    state.record = { ...record, refreshLeaseId: leaseId, refreshLeaseUntil: now + 15 };
    return { status: "claimed" as const, leaseId, record: { ...state.record } };
  });
  const persistCalTokenRefresh = vi.fn(
    async (
      token: string,
      leaseId: string,
      expectedVersion: number,
      update: {
        calAccessToken: string;
        calRefreshToken: string;
        calTokenExpiresAt: number;
      }
    ) => {
      const record = state.record;
      if (
        !record ||
        record.token !== token ||
        record.refreshLeaseId !== leaseId ||
        record.calTokenVersion !== expectedVersion
      ) {
        return undefined;
      }
      state.record = {
        ...record,
        ...update,
        calTokenVersion: expectedVersion + 1,
        refreshLeaseId: undefined,
        refreshLeaseUntil: undefined,
      };
      return { ...state.record };
    }
  );
  const invalidateCalTokenRefresh = vi.fn(
    async (token: string, leaseId: string, expectedVersion: number) => {
      const record = state.record;
      if (
        !record ||
        record.token !== token ||
        record.refreshLeaseId !== leaseId ||
        record.calTokenVersion !== expectedVersion
      ) {
        return false;
      }
      state.record = {
        ...record,
        calTokenInvalidAt: Math.floor(Date.now() / 1000),
        calTokenVersion: expectedVersion + 1,
        refreshLeaseId: undefined,
        refreshLeaseUntil: undefined,
      };
      return true;
    }
  );
  const releaseCalTokenRefresh = vi.fn(async () => true);

  return {
    state,
    loggerError: vi.fn(),
    getAccessToken,
    claimCalTokenRefresh,
    persistCalTokenRefresh,
    invalidateCalTokenRefresh,
    releaseCalTokenRefresh,
  };
});

vi.mock("../storage/token-store.js", () => ({
  claimCalTokenRefresh: mocks.claimCalTokenRefresh,
  consumeAuthCode: vi.fn(),
  createAccessToken: vi.fn(),
  createAuthCode: vi.fn(),
  createPendingAuth: vi.fn(),
  createRegisteredClient: vi.fn(),
  deleteAccessToken: vi.fn(),
  deleteAccessTokenByRefresh: vi.fn(),
  deletePendingAuth: vi.fn(),
  getAccessToken: mocks.getAccessToken,
  getPendingAuth: vi.fn(),
  getRegisteredClient: vi.fn(),
  invalidateCalTokenRefresh: mocks.invalidateCalTokenRefresh,
  persistCalTokenRefresh: mocks.persistCalTokenRefresh,
  releaseCalTokenRefresh: mocks.releaseCalTokenRefresh,
  rotateAccessToken: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.loggerError },
}));

const { resolveCalAuthHeaders } = await import("./oauth-handlers.js");

const config = {
  serverUrl: "https://mcp.example.com",
  calOAuthClientId: "cal-client",
  calOAuthClientSecret: "cal-client-secret",
  calApiBaseUrl: "https://api.cal.example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.record = {
    token: "mcp-access",
    refreshToken: "mcp-refresh",
    clientId: "client-1",
    calAccessToken: "old-cal-access",
    calRefreshToken: "old-cal-refresh",
    calTokenExpiresAt: Math.floor(Date.now() / 1000) - 1,
    calTokenVersion: 0,
    calTokenInvalidAt: undefined,
    refreshLeaseId: undefined,
    refreshLeaseUntil: undefined,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  mocks.state.leaseCounter = 0;
});

describe("Cal.com token refresh handler", () => {
  it("makes one upstream refresh and all waiters reuse the persisted rotated token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-cal-access",
          refresh_token: "new-cal-refresh",
          expires_in: 3600,
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const [first, second] = await Promise.all([
      resolveCalAuthHeaders("mcp-access", config),
      resolveCalAuthHeaders("mcp-access", config),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first?.Authorization).toBe("Bearer new-cal-access");
    expect(second?.Authorization).toBe("Bearer new-cal-access");
    expect(mocks.persistCalTokenRefresh).toHaveBeenCalledTimes(1);
  });

  it("fenced-invalidates an already-invalid grant and logs no credentials", async () => {
    const rejectedToken = mocks.state.record?.calRefreshToken;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: `Refresh token ${rejectedToken} is no longer valid`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(resolveCalAuthHeaders("mcp-access", config)).resolves.toBeUndefined();

    expect(mocks.state.record?.calTokenInvalidAt).toBeDefined();
    expect(mocks.invalidateCalTokenRefresh).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(rejectedToken);
  });

  it("does not persist a malformed successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "only-one-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(resolveCalAuthHeaders("mcp-access", config)).resolves.toBeUndefined();

    expect(mocks.persistCalTokenRefresh).not.toHaveBeenCalled();
    expect(mocks.state.record?.calAccessToken).toBe("old-cal-access");
  });
});
