#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKeyHeaders } from "./auth.js";
import { registerTools } from "./register-tools.js";
import { startHttpServer } from "./http-server.js";

async function main(): Promise<void> {
  // Validate API key is available at startup
  getApiKeyHeaders();

  const transport = process.env.MCP_TRANSPORT === "http" ? "http" : "stdio";
  const port = Number.parseInt(process.env.PORT || "3100", 10);

  console.error(`[mcp-server] Starting Cal.com MCP server (transport: ${transport})`);

  if (transport === "http") {
    startHttpServer(registerTools, port);
  } else {
    const server = new McpServer({
      name: "calcom-mcp-server",
      version: "0.1.0",
    });

    registerTools(server);

    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);

    console.error("[mcp-server] Cal.com MCP server running on stdio");
  }
}

main().catch((err) => {
  console.error("[mcp-server] Fatal error:", err);
  process.exit(1);
});
