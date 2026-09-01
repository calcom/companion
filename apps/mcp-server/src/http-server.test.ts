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
  handleAuthorize: vi.fn().mockResolvedValue(undefined),
  handleCallback: vi.fn().mockResolvedValue(undefined),
  handleRegister: vi.fn().mockResolvedValue(undefined),
  handleRevoke: vi.fn().mockResolvedValue(undefined),
  handleToken: vi.fn().mockResolvedValue(undefined),
  resolveCalAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer cal-token" }),
  connect: vi.fn().mockResolvedValue(undefined),
  transport: {
    sessionId: "session-1",
    handleRequest: vi.fn(async (_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    }),
    close: vi.fn().mockResolvedValue(undefined),
    onclose: undefined as (() => void) | undefined,
  },
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

vi.mock("./auth/oauth-handlers.js", () => ({
  handleAuthorize: mocks.handleAuthorize,
  handleCallback: mocks.handleCallback,
  handleRegister: mocks.handleRegister,
  handleRevoke: mocks.handleRevoke,
  handleToken: mocks.handleToken,
  resolveCalAuthHeaders: mocks.resolveCalAuthHeaders,
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    connect = mocks.connect;
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class {
    sessionId = mocks.transport.sessionId;
    handleRequest = mocks.transport.handleRequest;
    close = mocks.transport.close;
    onclose = mocks.transport.onclose;
  },
}));

vi.mock("./utils/telemetry.js", () => ({
  instrumentMcpTransport: <T>(transport: T): T => transport,
}));

import { startHttpServer } from "./http-server.js";

const oauthConfig = {
  serverUrl: "https://mcp.example.com",
  calOAuthClientId: "client-id",
  calOAuthClientSecret: "client-secret",
  calApiBaseUrl: "https://api.cal.com",
  calAppBaseUrl: "https://app.cal.com",
  calOAuthScopes: "PROFILE_READ",
};

function createRequest(
  path: string,
  method = "GET",
  headers: Record<string, string> = {}
): IncomingMessage {
  return {
    method,
    url: path,
    headers: { host: "mcp.example.com", ...headers },
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

async function request(path: string, method = "GET", headers: Record<string, string> = {}) {
  const response = createResponse();
  await mocks.listener?.(createRequest(path, method, headers), response);
  return response;
}

describe("bare Node HTTP server routing", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(process, "on").mockImplementation(() => process);
    mocks.listener = undefined;
    vi.clearAllMocks();
    mocks.sql.mockResolvedValue([{ ok: 1 }]);
    mocks.resolveCalAuthHeaders.mockResolvedValue({ Authorization: "Bearer cal-token" });
    mocks.transport.sessionId = "session-1";
    mocks.transport.onclose = undefined;

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

  it("reports degraded health when the database is unavailable", async () => {
    mocks.sql.mockRejectedValueOnce(new Error("database unavailable"));

    const health = await request("/health");

    expect(health.statusCode).toBe(503);
    expect(JSON.parse(health.body)).toMatchObject({ status: "degraded", db: "error" });
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

  it("uses origin-level metadata for the root MCP challenge", async () => {
    await startHttpServer(vi.fn(), {
      port: 3100,
      oauthConfig: { ...oauthConfig, serverUrl: "https://mcp.example.com/service" },
      rateLimitMax: 1_000,
    });

    const response = await request("/");

    expect(response.headers["WWW-Authenticate"]).toBe(
      'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
    );
  });

  it.each([
    ["POST", "/oauth/register", mocks.handleRegister],
    ["GET", "/oauth/authorize", mocks.handleAuthorize],
    ["GET", "/oauth/callback", mocks.handleCallback],
    ["POST", "/oauth/token", mocks.handleToken],
    ["POST", "/oauth/revoke", mocks.handleRevoke],
  ])("routes %s %s through its OAuth handler", async (method, path, handler) => {
    await request(path, method);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rate limits repeated unauthenticated MCP requests", async () => {
    await startHttpServer(vi.fn(), {
      port: 3100,
      oauthConfig,
      rateLimitMax: 1,
    });

    expect((await request("/")).statusCode).toBe(401);
    expect((await request("/")).statusCode).toBe(401);
    expect((await request("/")).statusCode).toBe(401);
    expect((await request("/")).statusCode).toBe(429);
  });

  it("creates, reuses, and deletes an authenticated MCP session", async () => {
    const authHeaders = { authorization: "Bearer mcp-token" };

    const created = await request("/mcp", "POST", authHeaders);
    expect(created.statusCode).toBe(200);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.transport.handleRequest).toHaveBeenCalledOnce();

    const sessionHeaders = { ...authHeaders, "mcp-session-id": "session-1" };
    const reused = await request("/mcp", "GET", sessionHeaders);
    expect(reused.statusCode).toBe(200);
    expect(mocks.transport.handleRequest).toHaveBeenCalledTimes(2);

    const deleted = await request("/mcp", "DELETE", sessionHeaders);
    expect(deleted.statusCode).toBe(200);
    expect(JSON.parse(deleted.body)).toEqual({ status: "terminated" });
    expect(mocks.transport.close).toHaveBeenCalledOnce();
  });
});
