import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listener: undefined as RequestListener | undefined,
  listen: vi.fn((_port: number, callback?: () => void) => callback?.()),
  close: vi.fn(),
  initDb: vi.fn().mockResolvedValue(undefined),
  endPool: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn().mockResolvedValue([{ ok: 1 }]),
  cleanupExpired: vi.fn().mockResolvedValue(undefined),
  countRegisteredClients: vi.fn().mockResolvedValue(0),
  handleRegister: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http")>();
  return {
    ...actual,
    createServer: vi.fn((listener: RequestListener) => {
      mocks.listener = listener;
      return { close: mocks.close, listen: mocks.listen };
    }),
  };
});

vi.mock("./storage/db.js", () => ({
  endPool: mocks.endPool,
  initDb: mocks.initDb,
  sql: mocks.sql,
}));

vi.mock("./storage/token-store.js", () => ({
  cleanupExpired: mocks.cleanupExpired,
  countRegisteredClients: mocks.countRegisteredClients,
}));

vi.mock("./auth/oauth-handlers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/oauth-handlers.js")>();
  return { ...actual, handleRegister: mocks.handleRegister };
});

import { startHttpServer } from "./http-server.js";

const oauthConfig = {
  serverUrl: "https://mcp.example.com",
  calOAuthClientId: "client-id",
  calOAuthClientSecret: "client-secret",
  calApiBaseUrl: "https://api.cal.com",
  calAppBaseUrl: "https://app.cal.com",
  calOAuthScopes: "PROFILE_READ",
};

function createRequest(path: string, method = "GET"): IncomingMessage {
  return {
    method,
    url: path,
    headers: { host: "mcp.example.com" },
    socket: { remoteAddress: "127.0.0.1" },
  } as IncomingMessage;
}

function createResponse(): ServerResponse & {
  body: string;
  headers: Record<string, string>;
  statusCode: number;
} {
  const response = {
    body: "",
    headers: {} as Record<string, string>,
    statusCode: 0,
    setHeader(name: string, value: string): void {
      response.headers[name] = value;
    },
    writeHead(statusCode: number, headers?: Record<string, string>): void {
      response.statusCode = statusCode;
      Object.assign(response.headers, headers);
    },
    end(body = ""): void {
      response.body = String(body);
    },
  };
  return response as unknown as ServerResponse & typeof response;
}

async function request(path: string, method = "GET") {
  const response = createResponse();
  await mocks.listener?.(createRequest(path, method), response);
  return response;
}

describe("bare Node HTTP server routing", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(process, "on").mockImplementation(() => process);
    mocks.listener = undefined;
    mocks.handleRegister.mockClear();
    mocks.sql.mockResolvedValue([{ ok: 1 }]);

    await startHttpServer(vi.fn(), {
      port: 3100,
      oauthConfig,
      rateLimitMax: 1_000,
      openaiAppsChallengeToken: "verification-token",
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serves health and verification endpoints", async () => {
    const health = await request("/health");
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({ status: "ok", db: "ok", sessions: 0 });

    const verification = await request("/.well-known/openai-apps-challenge");
    expect(verification.statusCode).toBe(200);
    expect(verification.body).toBe("verification-token");
  });

  it("serves OAuth metadata for canonical and root MCP resources", async () => {
    const authorizationServer = await request("/.well-known/oauth-authorization-server");
    expect(authorizationServer.statusCode).toBe(200);
    expect(JSON.parse(authorizationServer.body)).toMatchObject({
      issuer: "https://mcp.example.com",
    });

    const canonical = await request("/.well-known/oauth-protected-resource/mcp");
    expect(canonical.statusCode).toBe(200);
    expect(JSON.parse(canonical.body)).toMatchObject({ resource: "https://mcp.example.com/mcp" });

    const root = await request("/.well-known/oauth-protected-resource");
    expect(root.statusCode).toBe(200);
    expect(JSON.parse(root.body)).toMatchObject({ resource: "https://mcp.example.com" });
  });

  it.each([
    ["/mcp", "https://mcp.example.com/.well-known/oauth-protected-resource/mcp"],
    ["/", "https://mcp.example.com/.well-known/oauth-protected-resource"],
  ])("challenges unauthenticated MCP requests at %s", async (path, metadataUrl) => {
    const response = await request(path);
    expect(response.statusCode).toBe(401);
    expect(response.headers["WWW-Authenticate"]).toBe(`Bearer resource_metadata="${metadataUrl}"`);
  });

  it("routes dynamic client registration through the OAuth handler", async () => {
    await request("/oauth/register", "POST");
    expect(mocks.handleRegister).toHaveBeenCalledOnce();
  });
});
