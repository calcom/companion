#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKeyHeaders } from "./auth.js";
import type { HttpConfig, StdioConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { startHttpServer } from "./http-server.js";
import { registerTools } from "./register-tools.js";
import { SERVER_INSTRUCTIONS } from "./server-instructions.js";
import { logger, setLogLevel } from "./utils/logger.js";
import { instrumentMcpTransport } from "./utils/telemetry.js";

export async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Starting Cal.com MCP server", { transport: config.transport });

  if (config.transport === "http") {
    const httpConfig = config as HttpConfig;
    await startHttpServer(registerTools, {
      port: httpConfig.port,
      oauthConfig: {
        serverUrl: httpConfig.serverUrl,
        calOAuthClientId: httpConfig.calOAuthClientId,
        calOAuthClientSecret: httpConfig.calOAuthClientSecret,
        calApiBaseUrl: httpConfig.calApiBaseUrl,
        calAppBaseUrl: httpConfig.calAppBaseUrl,
        calOAuthScopes: httpConfig.calOAuthScopes,
      },
      rateLimitWindowMs: httpConfig.rateLimitWindowMs,
      rateLimitMax: httpConfig.rateLimitMax,
      maxSessions: httpConfig.maxSessions,
      sessionIdleTimeoutMs: httpConfig.sessionIdleTimeoutMs,
      maxRegisteredClients: httpConfig.maxRegisteredClients,
      allowedRedirectHosts: httpConfig.allowedRedirectHosts,
      allowOpenRedirectRegistration: httpConfig.allowOpenRedirectRegistration,
      corsOrigin: httpConfig.corsOrigin,
      shutdownTimeoutMs: httpConfig.shutdownTimeoutMs,
      openaiAppsChallengeToken: httpConfig.openaiAppsChallengeToken,
    });
  } else {
    const stdioConfig = config as StdioConfig;
    // Validate API key early so we fail fast
    process.env.CAL_API_KEY = stdioConfig.calApiKey;
    getApiKeyHeaders();

    const server = new McpServer(
      {
        name: "calcom-mcp-server",
        version: "0.1.0",
      },
      {
        instructions: SERVER_INSTRUCTIONS,
      }
    );

    registerTools(server);

    const stdioTransport = new StdioServerTransport();
    await server.connect(instrumentMcpTransport(stdioTransport));

    logger.info("Cal.com MCP server running on stdio");
  }
}

function isDirectExecution(): boolean {
  const executedPath = process.argv[1];
  if (!executedPath) return false;

  try {
    return realpathSync(executedPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (!process.env.MCP_MANAGED_ENTRYPOINT && isDirectExecution()) {
  main().catch((err) => {
    logger.error("Fatal error", { error: String(err) });
    process.exit(1);
  });
}
