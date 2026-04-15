import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { authContext } from "../src/auth/context.js";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
} from "../src/auth/oauth-metadata.js";
import {
  handleAuthorize,
  handleCallback,
  handleRegister,
  handleRevoke,
  handleToken,
  resolveCalAuthHeaders,
  type OAuthConfig,
} from "../src/auth/oauth-handlers.js";
import { loadConfig, type HttpConfig } from "../src/config.js";
import { registerTools } from "../src/register-tools.js";
import { SERVER_INSTRUCTIONS } from "../src/server-instructions.js";
import { initDb, sql } from "../src/storage/db.js";
import { countRegisteredClients } from "../src/storage/token-store.js";

/**
 * Vercel serverless entry point.
 *
 * Each invocation is stateless — the MCP transport is created per request
 * (`sessionIdGenerator: undefined`) and token/OAuth state lives in Postgres.
 * There are no setInterval loops, in-memory session maps, or graceful-shutdown
 * hooks because the runtime manages lifecycle for us.
 */

let cachedConfig: HttpConfig | undefined;
function getConfig(): HttpConfig {
  if (cachedConfig) return cachedConfig;
  const config = loadConfig();
  if (config.transport !== "http") {
    throw new Error("MCP_TRANSPORT must be 'http' on Vercel");
  }
  cachedConfig = config;
  return cachedConfig;
}

let dbInitPromise: Promise<void> | undefined;
function ensureDb(): Promise<void> {
  if (!dbInitPromise) dbInitPromise = initDb();
  return dbInitPromise;
}

function oauthConfigFromHttpConfig(config: HttpConfig): OAuthConfig {
  return {
    serverUrl: config.serverUrl,
    calOAuthClientId: config.calOAuthClientId,
    calOAuthClientSecret: config.calOAuthClientSecret,
    calApiBaseUrl: config.calApiBaseUrl,
    calAppBaseUrl: config.calAppBaseUrl,
  };
}

function setCorsHeaders(res: ServerResponse, corsOrigin: string | undefined): void {
  const origin = corsOrigin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (origin !== "*") res.setHeader("Vary", "Origin");
}

function jsonError(res: ServerResponse, status: number, error: string, description?: string): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error, ...(description ? { error_description: description } : {}) }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const config = getConfig();
  const oauthConfig = oauthConfigFromHttpConfig(config);
  await ensureDb();

  setCorsHeaders(res, config.corsOrigin);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // ── Health check ──
  if (url.pathname === "/health") {
    let dbOk = false;
    try {
      await sql`SELECT 1`;
      dbOk = true;
    } catch {
      /* db not healthy */
    }
    res.writeHead(dbOk ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: dbOk ? "ok" : "degraded", db: dbOk ? "ok" : "error" }));
    return;
  }

  // ── OAuth metadata ──
  if (url.pathname === "/.well-known/oauth-authorization-server" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildAuthorizationServerMetadata({ serverUrl: oauthConfig.serverUrl })));
    return;
  }
  if (url.pathname === "/.well-known/oauth-protected-resource" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildProtectedResourceMetadata({ serverUrl: oauthConfig.serverUrl })));
    return;
  }

  // ── OAuth endpoints ──
  if (url.pathname === "/oauth/register") {
    const currentCount = await countRegisteredClients();
    if (currentCount >= config.maxRegisteredClients) {
      jsonError(res, 503, "server_error", "Maximum number of registered clients reached");
      return;
    }
    await handleRegister(req, res);
    return;
  }
  if (url.pathname === "/oauth/authorize" && req.method === "GET") {
    await handleAuthorize(req, res, oauthConfig);
    return;
  }
  if (url.pathname === "/oauth/callback" && req.method === "GET") {
    await handleCallback(req, res, oauthConfig);
    return;
  }
  if (url.pathname === "/oauth/token") {
    await handleToken(req, res);
    return;
  }
  if (url.pathname === "/oauth/revoke") {
    await handleRevoke(req, res);
    return;
  }

  // ── MCP (stateless) ──
  if (url.pathname === "/mcp") {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!bearerToken) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ error: "unauthorized", error_description: "Bearer token required" }));
      return;
    }

    const calAuthHeaders = await resolveCalAuthHeaders(bearerToken, oauthConfig);
    if (!calAuthHeaders) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ error: "invalid_token", error_description: "Invalid or expired access token" }));
      return;
    }

    // DELETE in stateless mode is a no-op — there's no server-side session to terminate.
    if (req.method === "DELETE") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "terminated" }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = new McpServer(
      { name: "calcom-mcp-server", version: "0.1.0" },
      { instructions: SERVER_INSTRUCTIONS },
    );
    registerTools(server);
    await server.connect(transport);

    // Close the transport when the response finishes so the MCP server is
    // garbage-collected with the function invocation.
    res.on("close", () => {
      transport.close().catch(() => {});
    });

    await authContext.run(calAuthHeaders, async () => {
      await transport.handleRequest(req, res);
    });
    return;
  }

  jsonError(res, 404, "not_found");
}
