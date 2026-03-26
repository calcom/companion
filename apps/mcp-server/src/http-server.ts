import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/**
 * Start the MCP server over StreamableHTTP transport.
 *
 * Each HTTP session gets its own transport + McpServer instance so that
 * multiple clients can connect concurrently (stateful mode with session IDs).
 *
 * Routes:
 *   POST /mcp   — JSON-RPC over Streamable HTTP
 *   GET  /mcp   — SSE stream for server-initiated messages
 *   DELETE /mcp — Terminate a session
 *   GET  /health — Health check
 */
export function startHttpServer(
  registerTools: (server: McpServer) => void,
  port: number,
): void {
  // Map of sessionId -> { transport, server }
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // ── Health check ──
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
      return;
    }

    // ── MCP endpoint ──
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

      // For GET and POST, check if there's an existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      const existingSession = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && existingSession) {
        // Existing session — delegate to its transport
        await existingSession.transport.handleRequest(req, res);
        return;
      }

      if (sessionId && !existingSession) {
        // Unknown session ID
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      // No session ID — this should be an initialization request (POST)
      if (req.method === "POST") {
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
          sessions.set(newSessionId, { transport, server });
          console.error(`[mcp-server] New session: ${newSessionId}`);
        }

        // Handle the initialization request
        await transport.handleRequest(req, res);
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
    console.error(`[mcp-server] Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error("[mcp-server] Shutting down...");
    for (const [id, session] of sessions) {
      await session.transport.close();
      sessions.delete(id);
    }
    httpServer.close();
  };

  process.on("SIGINT", () => { shutdown().then(() => process.exit(0)); });
  process.on("SIGTERM", () => { shutdown().then(() => process.exit(0)); });
}
