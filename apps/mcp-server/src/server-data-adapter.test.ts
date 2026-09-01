import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  endPool: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn().mockResolvedValue([{ ok: 1 }]),
  cleanupExpired: vi.fn().mockResolvedValue(undefined),
  countRegisteredClients: vi.fn().mockResolvedValue(3),
  resolveCalAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer real" }),
}));

vi.mock("./storage/db.js", () => ({
  initDb: mocks.initDb,
  endPool: mocks.endPool,
  sql: mocks.sql,
}));

vi.mock("./storage/token-store.js", () => ({
  cleanupExpired: mocks.cleanupExpired,
  countRegisteredClients: mocks.countRegisteredClients,
}));

vi.mock("./auth/oauth-handlers.js", () => ({
  resolveCalAuthHeaders: mocks.resolveCalAuthHeaders,
}));

import { createServerDataAdapter } from "./server-data-adapter.js";

const oauthConfig = {
  serverUrl: "https://preview.example.com",
  calOAuthClientId: "unused",
  calOAuthClientSecret: "unused",
  calApiBaseUrl: "https://api.cal.com",
};

describe("server data adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses an inert empty-deny adapter only for the explicit Vercel preview mode", async () => {
    const adapter = createServerDataAdapter({
      VERCEL_ENV: "preview",
      MCP_PREVIEW_SMOKE_MODE: "empty-deny",
    });

    expect(adapter.mode).toBe("preview-empty-deny");
    await adapter.initialize();
    expect(await adapter.checkHealth()).toBe(true);
    await adapter.cleanupExpired();
    expect(await adapter.countRegisteredClients()).toBe(0);
    expect(await adapter.resolveCalAuthHeaders("untrusted-token", oauthConfig)).toBeUndefined();
    await adapter.close();

    expect(mocks.initDb).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.cleanupExpired).not.toHaveBeenCalled();
    expect(mocks.countRegisteredClients).not.toHaveBeenCalled();
    expect(mocks.resolveCalAuthHeaders).not.toHaveBeenCalled();
    expect(mocks.endPool).not.toHaveBeenCalled();
  });

  it.each([
    [{ VERCEL_ENV: "preview" }, "missing switch"],
    [{ VERCEL_ENV: "preview", MCP_PREVIEW_SMOKE_MODE: "invalid" }, "invalid switch"],
    [{ VERCEL_ENV: "production", MCP_PREVIEW_SMOKE_MODE: "empty-deny" }, "production"],
  ])("uses the real adapter for %s (%s)", async (env) => {
    const adapter = createServerDataAdapter(env);

    expect(adapter.mode).toBe("real");
    await adapter.initialize();
    expect(await adapter.checkHealth()).toBe(true);
    await adapter.cleanupExpired();
    expect(await adapter.countRegisteredClients()).toBe(3);
    expect(await adapter.resolveCalAuthHeaders("token", oauthConfig)).toEqual({
      Authorization: "Bearer real",
    });
    await adapter.close();

    expect(mocks.initDb).toHaveBeenCalledOnce();
    expect(mocks.sql).toHaveBeenCalledOnce();
    expect(mocks.cleanupExpired).toHaveBeenCalledOnce();
    expect(mocks.countRegisteredClients).toHaveBeenCalledOnce();
    expect(mocks.resolveCalAuthHeaders).toHaveBeenCalledOnce();
    expect(mocks.endPool).toHaveBeenCalledOnce();
  });
});
