import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  loadConfig: vi.fn(() => ({
    transport: "http",
    serverUrl: "https://mcp.example.com",
    calOAuthClientId: "client-id",
    calOAuthClientSecret: "client-secret",
    calApiBaseUrl: "https://api.cal.com",
    calAppBaseUrl: "https://app.cal.com",
    calOAuthScopes: "PROFILE_READ",
    corsOrigin: undefined,
    allowedRedirectHosts: [],
    allowOpenRedirectRegistration: false,
    maxRegisteredClients: 10_000,
  })),
}));

vi.mock("./config.js", () => ({ loadConfig: mocks.loadConfig }));
vi.mock("./storage/db.js", () => ({ initDb: mocks.initDb, sql: vi.fn() }));

function createResponse(): ServerResponse & {
  body: string;
  headers: Record<string, string>;
  statusCode: number;
} {
  const response = {
    body: "",
    headers: {},
    statusCode: 0,
    setHeader: vi.fn(),
    writeHead(statusCode: number, headers?: Record<string, string>): void {
      response.statusCode = statusCode;
      Object.assign(response.headers, headers);
    },
    end(body = ""): void {
      response.body = String(body);
    },
  };
  return response as unknown as ServerResponse & {
    body: string;
    headers: Record<string, string>;
    statusCode: number;
  };
}

describe("Vercel root MCP endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.initDb.mockClear();
    mocks.loadConfig.mockClear();
  });

  it("challenges an HTML-accepting root request instead of redirecting to docs", async () => {
    const { default: handler } = await import("./vercel-handler.js");
    const response = createResponse();

    await handler(
      {
        method: "GET",
        url: "/",
        headers: { accept: "text/html", host: "mcp.example.com" },
      } as IncomingMessage,
      response
    );

    expect(response.statusCode).toBe(401);
    expect(response.headers.Location).toBeUndefined();
    expect(response.headers["WWW-Authenticate"]).toBe(
      'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
    );
  });
});
