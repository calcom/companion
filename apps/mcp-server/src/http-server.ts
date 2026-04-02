import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authContext } from "./auth/context.js";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
} from "./auth/oauth-metadata.js";
import {
  handleRegister,
  handleAuthorize,
  handleCallback,
  handleToken,
  handleRevoke,
  resolveCalAuthHeaders,
} from "./auth/oauth-handlers.js";
import type { OAuthConfig } from "./auth/oauth-handlers.js";
import { getDb, closeDb } from "./storage/db.js";
import { cleanupExpired, countRegisteredClients } from "./storage/token-store.js";
import { logger, withLogContext } from "./utils/logger.js";
import { RateLimiter, getClientIp, sendRateLimited } from "./utils/rate-limiter.js";

export interface HttpServerConfig {
  port: number;
  oauthConfig: OAuthConfig;
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  maxSessions?: number;
  sessionIdleTimeoutMs?: number;
  maxRegisteredClients?: number;
  corsOrigin?: string;
  shutdownTimeoutMs?: number;
}

/**
 * Start the MCP server over StreamableHTTP transport with OAuth 2.1 authentication.
 *
 * Each HTTP session gets its own transport + McpServer instance so that
 * multiple clients can connect concurrently (stateful mode with session IDs).
 *
 * Routes:
 *   POST /mcp   — JSON-RPC over Streamable HTTP (requires Bearer token)
 *   GET  /mcp   — SSE stream for server-initiated messages
 *   DELETE /mcp — Terminate a session
 *   GET  /health — Health check
 *   GET  /.well-known/oauth-authorization-server — OAuth AS metadata
 *   GET  /.well-known/oauth-protected-resource — Protected resource metadata
 *   POST /oauth/register — Dynamic client registration
 *   GET  /oauth/authorize — Start OAuth flow (redirects to Cal.com)
 *   GET  /oauth/callback — Cal.com OAuth callback
 *   POST /oauth/token — Token exchange / refresh
 *   POST /oauth/revoke — Token revocation
 */
const startedAt = Date.now();

export function startHttpServer(
  registerTools: (server: McpServer) => void,
  config: HttpServerConfig,
): void {
  const { port, oauthConfig } = config;
  const maxSessions = config.maxSessions ?? Number(process.env.MAX_SESSIONS) || 10_000;
  const sessionIdleTimeoutMs = config.sessionIdleTimeoutMs ?? Number(process.env.SESSION_IDLE_TIMEOUT_MS) || 30 * 60 * 1000;
  const maxRegisteredClients = config.maxRegisteredClients ?? Number(process.env.MAX_REGISTERED_CLIENTS) || 10_000;
  const corsOrigin = config.corsOrigin ?? process.env.CORS_ORIGIN;
  const shutdownTimeoutMs = config.shutdownTimeoutMs ?? Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

  getDb();

  const rateLimitWindowMs = config.rateLimitWindowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const rateLimitMax = config.rateLimitMax ?? Number(process.env.RATE_LIMIT_MAX) || 30;
  const oauthRateLimiter = new RateLimiter({ windowMs: rateLimitWindowMs, max: rateLimitMax });
  oauthRateLimiter.startGc();
  const mcpRateLimiter = new RateLimiter({ windowMs: rateLimitWindowMs, max: rateLimitMax * 3 });
  mcpRateLimiter.startGc();

  const cleanupInterval = setInterval(() => {
    try {
      cleanupExpired();
    } catch (err) {
      logger.error("Cleanup error", { error: String(err) });
    }
  }, 5 * 60 * 1000);

  const sessions = new Map<
    string,
    {
      transport: StreamableHTTPServerTransport;
      server: McpServer;
      calAuthHeaders: Record<string, string>;
      lastActivityAt: number;
    }
  >();

  // Idle session eviction
  const sessionEvictionInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt > sessionIdleTimeoutMs) {
        session.transport.close().catch(() => {});
        sessions.delete(id);
        logger.info("Evicted idle session", { sessionId: id });
      }
    }
  }, 60_000);
  if (sessionEvictionInterval.unref) sessionEvictionInterval.unref();

  const asMetadata = buildAuthorizationServerMetadata({ serverUrl: oauthConfig.serverUrl });
  const prMetadata = buildProtectedResourceMetadata({ serverUrl: oauthConfig.serverUrl });

  /** Add CORS headers if configured. */
  function setCorsHeaders(res: import("node:http").ServerResponse): void {
    const origin = corsOrigin ?? "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (origin !== "*") {
      res.setHeader("Vary", "Origin");
    }
  }

  const httpServer = createServer(async (req, res) => {
    const requestId = randomUUID();
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    setCorsHeaders(res);

    // ── CORS preflight ──
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── Health check ──
    if (url.pathname === "/health") {
      let dbOk = false;
      try {
        const db = getDb();
        db.prepare("SELECT 1").get();
        dbOk = true;
      } catch { /* db not healthy */ }
      const status = dbOk ? "ok" : "degraded";
      const code = dbOk ? 200 : 503;
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status,
        sessions: sessions.size,
        db: dbOk ? "ok" : "error",
        uptime: Math.floor((Date.now() - startedAt) / 1000),
      }));
      return;
    }

    // ── OAuth metadata endpoints ──
    if (url.pathname === "/.well-known/oauth-authorization-server" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(asMetadata));
      return;
    }

    if (url.pathname === "/.well-known/oauth-protected-resource" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(prMetadata));
      return;
    }

    // ── OAuth flow endpoints (rate-limited) ──
    if (url.pathname.startsWith("/oauth/")) {
      const clientIp = getClientIp(req);
      if (!oauthRateLimiter.consume(clientIp)) {
        sendRateLimited(res);
        return;
      }

      if (url.pathname === "/oauth/register") {
        // Enforce max registered clients limit
        const currentCount = countRegisteredClients();
        if (currentCount >= maxRegisteredClients) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "server_error", error_description: "Maximum number of registered clients reached" }));
          return;
        }
        await handleRegister(req, res);
        return;
      }
      if (url.pathname === "/oauth/authorize" && req.method === "GET") {
        handleAuthorize(req, res, oauthConfig);
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
    }

    // ── MCP endpoint (requires Bearer token, rate-limited) ──
    if (url.pathname === "/mcp") {
      const clientIp = getClientIp(req);
      if (!mcpRateLimiter.consume(clientIp)) {
        sendRateLimited(res);
        return;
      }

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

      if (req.method === "DELETE") {
        const calAuthHeaders = await resolveCalAuthHeaders(bearerToken, oauthConfig);
        if (!calAuthHeaders) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl}/.well-known/oauth-protected-resource"`,
          });
          res.end(JSON.stringify({ error: "invalid_token", error_description: "Invalid or expired access token" }));
          return;
        }
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const session = sessionId ? sessions.get(sessionId) : undefined;
        if (sessionId && session) {
          await session.transport.close();
          sessions.delete(sessionId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "terminated" }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found" }));
        }
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      const existingSession = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && existingSession) {
        existingSession.lastActivityAt = Date.now();
        const freshHeaders = bearerToken ? await resolveCalAuthHeaders(bearerToken, oauthConfig) : undefined;
        if (!freshHeaders) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${oauthConfig.serverUrl}/.well-known/oauth-protected-resource"`,
          });
          res.end(JSON.stringify({ error: "invalid_token", error_description: "Cal.com token expired and could not be refreshed" }));
          return;
        }
        existingSession.calAuthHeaders = freshHeaders;

        await withLogContext({ requestId, sessionId }, async () => {
          await authContext.run(freshHeaders, async () => {
            await existingSession.transport.handleRequest(req, res);
          });
        });
        return;
      }

      if (sessionId && !existingSession) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      if (req.method === "POST") {
        // Enforce max sessions limit
        if (sessions.size >= maxSessions) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "server_error", error_description: "Maximum number of sessions reached" }));
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

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        const server = new McpServer({
          name: "calcom-mcp-server",
          version: "0.1.0",
        });

        registerTools(server);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
            logger.info("Session closed", { sessionId: sid });
          }
        };

        await server.connect(transport);

        await withLogContext({ requestId }, async () => {
          await authContext.run(calAuthHeaders, async () => {
            await transport.handleRequest(req, res);
          });
        });

        const newSessionId = transport.sessionId;
        if (newSessionId) {
          sessions.set(newSessionId, { transport, server, calAuthHeaders, lastActivityAt: Date.now() });
          logger.info("New session created", { sessionId: newSessionId });
        }
        return;
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing mcp-session-id header" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info("StreamableHTTP server started", {
      port,
      mcpEndpoint: `http://localhost:${port}/mcp`,
      oauthEndpoints: `http://localhost:${port}/oauth/*`,
      healthCheck: `http://localhost:${port}/health`,
    });
  });

  const shutdown = async () => {
    logger.info("Shutting down...");

    // 1. Stop accepting new connections
    httpServer.close();

    // 2. Stop background tasks
    clearInterval(cleanupInterval);
    clearInterval(sessionEvictionInterval);
    oauthRateLimiter.stopGc();
    mcpRateLimiter.stopGc();

    // 3. Drain existing sessions with a timeout
    const drainPromise = Promise.all(
      Array.from(sessions.entries()).map(async ([id, session]) => {
        try {
          await session.transport.close();
        } catch { /* best effort */ }
        sessions.delete(id);
      }),
    );

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, shutdownTimeoutMs));
    await Promise.race([drainPromise, timeout]);

    // 4. Close database
    closeDb();
    logger.info("Shutdown complete");
  };

  process.on("SIGINT", () => {
    shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
  });
  process.on("SIGTERM", () => {
    shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
  });
}
