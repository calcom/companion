import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { authContext } from "./auth/context.js";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
} from "./auth/oauth-metadata.js";
import {
  handleAuthorize,
  handleCallback,
  handleRegister,
  handleRevoke,
  handleToken,
  resolveCalAuthHeaders,
  type OAuthConfig,
} from "./auth/oauth-handlers.js";
import { loadConfig, type HttpConfig } from "./config.js";
import { registerTools } from "./register-tools.js";
import { SERVER_INSTRUCTIONS } from "./server-instructions.js";
import { initDb, sql } from "./storage/db.js";
import { countRegisteredClients } from "./storage/token-store.js";

/**
 * Vercel serverless entry point.
 *
 * Each invocation is stateless — the MCP transport is created per request
 * (`sessionIdGenerator: undefined`) and token/OAuth state lives in Postgres.
 * There are no setInterval loops, in-memory session maps, or graceful-shutdown
 * hooks because the runtime manages lifecycle for us.
 *
 * This module lives under `src/` (not `api/`) so it gets compiled by our
 * `bun run build` step into `dist/vercel-handler.js`. The Vercel function
 * at `api/index.js` is a thin JS wrapper re-exporting from the compiled
 * output, which avoids @vercel/node having to run TypeScript over the
 * heavy `@modelcontextprotocol/sdk` types (which OOMs in practice).
 */

let cachedConfig: HttpConfig | undefined;
function getConfig(): HttpConfig {
  if (cachedConfig) return cachedConfig;
  // This handler only runs on Vercel, which is always HTTP mode. Force the
  // transport so operators do not have to remember to set MCP_TRANSPORT=http.
  process.env.MCP_TRANSPORT = "http";
  const config = loadConfig();
  if (config.transport !== "http") {
    throw new Error("MCP_TRANSPORT must be 'http' on Vercel");
  }
  cachedConfig = config;
  return cachedConfig;
}

let dbInitPromise: Promise<void> | undefined;
function ensureDb(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((err) => {
      dbInitPromise = undefined;
      throw err;
    });
  }
  return dbInitPromise;
}

function oauthConfigFromHttpConfig(config: HttpConfig): OAuthConfig {
  return {
    serverUrl: config.serverUrl,
    calOAuthClientId: config.calOAuthClientId,
    calOAuthClientSecret: config.calOAuthClientSecret,
    calApiBaseUrl: config.calApiBaseUrl,
    calAppBaseUrl: config.calAppBaseUrl,
    calOAuthScopes: config.calOAuthScopes,
  };
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse, corsOrigin: string | undefined): void {
  // Credentialed requests (Authorization header) require an explicit origin,
  // not "*". Fall back to echoing the request's Origin header.
  const origin = corsOrigin ?? req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  // Include mcp-protocol-version and last-event-id: the MCP client adds these custom
  // headers on every request after initialization. Without them the browser's CORS
  // preflight fails with "header not allowed".
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version, last-event-id",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

function jsonError(res: ServerResponse, status: number, error: string, description?: string): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error, ...(description ? { error_description: description } : {}) }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const config = getConfig();
  const oauthConfig = oauthConfigFromHttpConfig(config);
  await ensureDb();

  setCorsHeaders(req, res, config.corsOrigin);

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

  // ── OpenAI Apps domain verification ──
  // Serves a static challenge token at the well-known URL so OpenAI can verify
  // we control this hostname. No auth — OpenAI fetches it anonymously.
  // The token is provided via the OPENAI_APPS_CHALLENGE_TOKEN env var.
  if (url.pathname === "/.well-known/openai-apps-challenge" && req.method === "GET") {
    const token = config.openaiAppsChallengeToken;
    if (!token) {
      jsonError(res, 404, "not_found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
    res.end(token);
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
  // Accept both /mcp (canonical) and / (base URL) so that Claude.ai works whether
  // the user enters "https://mcp.cal.com" or "https://mcp.cal.com/mcp".
  // Redirect browsers visiting the root URL to the documentation page.
  if (url.pathname === "/") {
    const accept = req.headers.accept ?? "";
    if (req.method === "GET" && !req.headers.authorization && accept.includes("text/html")) {
      res.writeHead(302, { Location: "https://cal.com/docs/mcp-server" });
      res.end();
      return;
    }
  }

  if (url.pathname === "/mcp" || url.pathname === "/") {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!bearerToken) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl.replace(/\/+$/, "")}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ error: "unauthorized", error_description: "Bearer token required" }));
      return;
    }

    const calAuthHeaders = await resolveCalAuthHeaders(bearerToken, oauthConfig);
    if (!calAuthHeaders) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl.replace(/\/+$/, "")}/.well-known/oauth-protected-resource"`,
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

    // GET opens a long-lived SSE stream for server-initiated messages. Vercel
    // serverless functions cannot hold persistent connections, so we return 405.
    // The MCP client treats 405 as "SSE not supported" and switches to POST-only
    // mode — no error, it just skips the standalone stream.
    if (req.method === "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed", error_description: "SSE stream not supported in serverless mode" }));
      return;
    }

    // ── Minimal in-process JSON-RPC transport ──────────────────────────────────
    //
    // StreamableHTTPServerTransport uses @hono/node-server's getRequestListener
    // under the hood. That adapter converts the Node.js IncomingMessage body to a
    // Web ReadableStream and then awaits `reader.closed` before it considers the
    // response done. On Vercel, that promise never resolves → 60 s timeout.
    //
    // We bypass all of that by:
    //   1. Reading the raw body ourselves (pure Node.js streams — always works).
    //   2. Wiring a trivial Transport object straight to McpServer.
    //   3. Driving messages in → collecting responses out → writing JSON directly.
    //   No ReadableStream, no Hono, no reader.closed, no SSE.

    // -- 1. Read request body --------------------------------------------------
    const bodyText = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });

    let rawMessage: unknown;
    try {
      rawMessage = JSON.parse(bodyText);
    } catch {
      jsonError(res, 400, "parse_error", "Request body is not valid JSON");
      return;
    }

    const messages: JSONRPCMessage[] = (Array.isArray(rawMessage) ? rawMessage : [rawMessage]) as JSONRPCMessage[];

    // JSON-RPC requests have an `id` field; notifications do not.
    const requestIds = messages
      .filter((m): m is JSONRPCMessage & { id: string | number } => "id" in m && m.id != null)
      .map((m) => (m as { id: string | number }).id);

    // If there are no requests (pure notifications batch), acknowledge with 202.
    if (requestIds.length === 0) {
      res.writeHead(202);
      res.end();
      return;
    }

    // -- 2. Build minimal Transport --------------------------------------------
    const collectedResponses = new Map<string | number, JSONRPCMessage>();
    let resolveAll!: () => void;
    const allDone = new Promise<void>((r) => { resolveAll = r; });

    const transport: Transport = {
      // These callbacks are set by McpServer.connect() before start() returns.
      onmessage: undefined,
      onclose: undefined,
      onerror: undefined,

      async start() { /* nothing to set up */ },
      async close() { transport.onclose?.(); },

      async send(msg: JSONRPCMessage) {
        // Only capture responses (they have `id` + `result`/`error`, but no `method`);
        // ignore server-initiated requests (which have `method` + `id`).
        if ("id" in msg && msg.id != null && !("method" in msg)) {
          collectedResponses.set((msg as { id: string | number }).id, msg);
          if (collectedResponses.size >= requestIds.length) resolveAll();
        }
      },
    };

    // -- 3. Connect McpServer and drive messages --------------------------------
    const server = new McpServer(
      { name: "calcom-mcp-server", version: "0.1.0" },
      { instructions: SERVER_INSTRUCTIONS },
    );
    registerTools(server);
    await server.connect(transport);

    // 55 s gives a ~5 s buffer before Vercel's 60 s hard limit.
    const timeoutMs = 55_000;

    try {
      await authContext.run(calAuthHeaders, async () => {
        for (const msg of messages) {
          transport.onmessage?.(msg, {});
        }
        await Promise.race([
          allDone,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`MCP handler timed out after ${timeoutMs} ms`)), timeoutMs),
          ),
        ]);
      });
    } finally {
      transport.close().catch(() => {});
    }

    // -- 4. Return JSON --------------------------------------------------------
    const responsePayload = Array.isArray(rawMessage)
      ? requestIds.map((id) => collectedResponses.get(id) ?? null)
      : collectedResponses.get(requestIds[0]) ?? null;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responsePayload));
    return;
  }

  jsonError(res, 404, "not_found");
}
