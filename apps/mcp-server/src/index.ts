#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKeyHeaders } from "./auth.js";
import { loadConfig } from "./config.js";
import type { HttpConfig, StdioConfig } from "./config.js";
import { registerTools } from "./register-tools.js";
import { startHttpServer } from "./http-server.js";
import { logger, setLogLevel } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Starting Cal.com MCP server", { transport: config.transport });

  if (config.transport === "http") {
    const httpConfig = config as HttpConfig;
    startHttpServer(registerTools, {
      port: httpConfig.port,
      oauthConfig: {
        serverUrl: httpConfig.serverUrl,
        calOAuthClientId: httpConfig.calOAuthClientId,
        calOAuthClientSecret: httpConfig.calOAuthClientSecret,
        calApiBaseUrl: httpConfig.calApiBaseUrl,
        calAppBaseUrl: httpConfig.calAppBaseUrl,
      },
      rateLimitWindowMs: httpConfig.rateLimitWindowMs,
      rateLimitMax: httpConfig.rateLimitMax,
      maxSessions: httpConfig.maxSessions,
      sessionIdleTimeoutMs: httpConfig.sessionIdleTimeoutMs,
      maxRegisteredClients: httpConfig.maxRegisteredClients,
      corsOrigin: httpConfig.corsOrigin,
      shutdownTimeoutMs: httpConfig.shutdownTimeoutMs,
    });
  } else {
    const stdioConfig = config as StdioConfig;
    // Validate API key early so we fail fast
    process.env.CAL_API_KEY = stdioConfig.calApiKey;
    getApiKeyHeaders();

    const server = new McpServer({
      name: "calcom-mcp-server",
      version: "0.1.0",
    });

    registerTools(server);

    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);

    logger.info("Cal.com MCP server running on stdio");
  }
}

main().catch((err) => {
  logger.error("Fatal error", { error: String(err) });
  process.exit(1);
});
