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
import { cleanupExpired } from "./storage/token-store.js";

export interface HttpServerConfig {
  port: number;
  oauthConfig: OAuthConfig;
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
export function startHttpServer(
  registerTools: (server: McpServer) => void,
  config: HttpServerConfig,
): void {
  const { port, oauthConfig } = config;

  // Initialize SQLite database
  getDb();

  // Periodically clean up expired tokens (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    try {
      cleanupExpired();
    } catch (err) {
      console.error("[mcp-server] Cleanup error:", err);
    }
  }, 5 * 60 * 1000);

  // Map of sessionId -> { transport, server, calAuthHeaders }
  const sessions = new Map<
    string,
    {
      transport: StreamableHTTPServerTransport;
      server: McpServer;
      calAuthHeaders: Record<string, string>;
    }
  >();

  const asMetadata = buildAuthorizationServerMetadata({ serverUrl: oauthConfig.serverUrl });
  const prMetadata = buildProtectedResourceMetadata({ serverUrl: oauthConfig.serverUrl });

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // ── Health check ──
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
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

    // ── OAuth flow endpoints ──
    if (url.pathname === "/oauth/register") {
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

    // ── MCP endpoint (requires Bearer token) ──
    if (url.pathname === "/mcp") {
      // Handle DELETE — terminate session
      if (req.method === "DELETE") {
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

      // Extract and validate Bearer token
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

      // For GET and POST, check if there's an existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      const existingSession = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && existingSession) {
        // Existing session — run in auth context and delegate
        await authContext.run(existingSession.calAuthHeaders, async () => {
          await existingSession.transport.handleRequest(req, res);
        });
        return;
      }

      if (sessionId && !existingSession) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      // No session ID — this should be an initialization request (POST)
      if (req.method === "POST") {
        // Resolve Cal.com auth headers from Bearer token
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

        // Clean up session on transport close
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
            console.error(`[mcp-server] Session ${sid} closed`);
          }
        };

        await server.connect(transport);

        // Store session after connect (sessionId is now set)
        const newSessionId = transport.sessionId;
        if (newSessionId) {
          sessions.set(newSessionId, { transport, server, calAuthHeaders });
          console.error(`[mcp-server] New session: ${newSessionId}`);
        }

        // Handle the initialization request within the auth context
        await authContext.run(calAuthHeaders, async () => {
          await transport.handleRequest(req, res);
        });
        return;
      }

      // GET without session ID is invalid
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing mcp-session-id header" }));
      return;
    }

    // ── Not found ──
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    console.error(`[mcp-server] StreamableHTTP server listening on http://localhost:${port}/mcp`);
    console.error(`[mcp-server] OAuth endpoints: http://localhost:${port}/oauth/*`);
    console.error(`[mcp-server] Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error("[mcp-server] Shutting down...");
    clearInterval(cleanupInterval);
    for (const [id, session] of sessions) {
      await session.transport.close();
      sessions.delete(id);
    }
    httpServer.close();
    closeDb();
  };

  process.on("SIGINT", () => {
    shutdown().then(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    shutdown().then(() => process.exit(0));
  });
}
