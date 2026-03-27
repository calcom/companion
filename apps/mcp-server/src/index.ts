#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKeyHeaders } from "./auth.js";
import { registerTools } from "./register-tools.js";
import { startHttpServer } from "./http-server.js";

async function main(): Promise<void> {
  const transport = process.env.MCP_TRANSPORT === "http" ? "http" : "stdio";
  const port = Number.parseInt(process.env.PORT || "3100", 10);

  console.error(`[mcp-server] Starting Cal.com MCP server (transport: ${transport})`);

  if (transport === "http") {
    // HTTP mode uses OAuth 2.1 — validate required OAuth env vars
    const calOAuthClientId = process.env.CAL_OAUTH_CLIENT_ID;
    const calOAuthClientSecret = process.env.CAL_OAUTH_CLIENT_SECRET;
    const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    const serverUrl = process.env.MCP_SERVER_URL;

    if (!calOAuthClientId || !calOAuthClientSecret || !tokenEncryptionKey || !serverUrl) {
      console.error(
        "[mcp-server] HTTP mode requires: CAL_OAUTH_CLIENT_ID, CAL_OAUTH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, MCP_SERVER_URL",
      );
      process.exit(1);
    }

    const calApiBaseUrl = process.env.CAL_API_BASE_URL || "https://api.cal.com";

    startHttpServer(registerTools, {
      port,
      oauthConfig: {
        serverUrl,
        calOAuthClientId,
        calOAuthClientSecret,
        calApiBaseUrl,
      },
    });
  } else {
    // stdio mode uses API key auth
    getApiKeyHeaders();

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
