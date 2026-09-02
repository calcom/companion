#!/usr/bin/env node

import { realpathSync } from "node:fs";
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type Attributes,
  context,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  type TextMapGetter,
  trace,
} from "@opentelemetry/api";
import { getApiKeyHeaders } from "./auth.js";
import type { HttpConfig, StdioConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { startHttpServer } from "./http-server.js";
import { registerTools } from "./register-tools.js";
import { SERVER_INSTRUCTIONS } from "./server-instructions.js";
import { logger, setLogLevel } from "./utils/logger.js";
import { instrumentMcpTransport } from "./utils/telemetry.js";

export interface MainOptions {
  /** Bind the HTTP transport to its configured port. Disable for managed runtimes. */
  listen?: boolean;
}

const OTEL_REGISTERED_KEY = "__calcomMcpOtelRegistered";
const managedRequestTracer = trace.getTracer("@calcom/mcp-server", "0.1.0");
const KNOWN_HTTP_METHODS = new Set([
  "CONNECT",
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "QUERY",
  "TRACE",
]);
const HTTP_ROUTES = new Set([
  "/",
  "/health",
  "/mcp",
  "/.well-known/openai-apps-challenge",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
  "/oauth/authorize",
  "/oauth/callback",
  "/oauth/register",
  "/oauth/revoke",
  "/oauth/token",
]);
const incomingHeadersGetter: TextMapGetter<IncomingHttpHeaders> = {
  keys: (headers) => Object.keys(headers),
  get: (headers, key) => headers[key.toLowerCase()],
};
let managedServerPromise: Promise<Server> | undefined;
let telemetryRegistrationPromise: Promise<void> | undefined;

async function ensureVercelTelemetryRegistered(): Promise<void> {
  const registrationState = globalThis as Record<string, unknown>;
  if (registrationState[OTEL_REGISTERED_KEY]) return;

  telemetryRegistrationPromise ??= import("@vercel/otel").then(({ registerOTel }) => {
    if (registrationState[OTEL_REGISTERED_KEY]) return;
    registerOTel({
      serviceName: "cal-mcp-server",
      instrumentations: ["fetch"],
    });
    registrationState[OTEL_REGISTERED_KEY] = true;
    console.info("[otel] registered cal-mcp-server with fetch instrumentation");
  });
  await telemetryRegistrationPromise;
}

export async function main(
  options: MainOptions = {}
): Promise<import("node:http").Server | undefined> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Starting Cal.com MCP server", { transport: config.transport });

  if (config.transport === "http") {
    const httpConfig = config as HttpConfig;
    return startHttpServer(
      registerTools,
      {
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
      },
      { listen: options.listen }
    );
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

/** Vercel Node function entrypoint. */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  process.env.MCP_MANAGED_ENTRYPOINT = "vercel";
  process.env.MCP_TRANSPORT = "http";
  await ensureVercelTelemetryRegistered();

  const parentContext = propagation.extract(ROOT_CONTEXT, request.headers, incomingHeadersGetter);
  await context.with(parentContext, () => traceManagedRequest(request, response));
}

function traceManagedRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const originalMethod = request.method ?? "GET";
  const method = KNOWN_HTTP_METHODS.has(originalMethod) ? originalMethod : "_OTHER";
  const path = getRequestPath(request.url);
  const route = HTTP_ROUTES.has(path) ? path : undefined;
  const spanMethod = method === "_OTHER" ? "HTTP" : method;
  const spanName = route ? `${spanMethod} ${route}` : spanMethod;
  const attributes = getHttpServerAttributes(request, method, originalMethod, path, route);

  return managedRequestTracer.startActiveSpan(
    spanName,
    {
      kind: SpanKind.SERVER,
      attributes,
    },
    async (span: Span): Promise<void> => {
      try {
        managedServerPromise ??= main({ listen: false }).then((server) => {
          if (!server) throw new Error("Vercel entrypoint requires the HTTP transport");
          return server;
        });
        const server = await managedServerPromise;
        const result = await dispatchManagedRequest(server, request, response);
        if (response.headersSent || result.completed) {
          span.setAttribute("http.response.status_code", response.statusCode);
        }
        if (result.errorType) {
          span.setAttribute("error.type", result.errorType);
          span.setStatus({ code: SpanStatusCode.ERROR });
        } else if (response.statusCode >= 500) {
          span.setAttribute("error.type", String(response.statusCode));
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
      } catch (error) {
        if (response.headersSent) {
          span.setAttribute("http.response.status_code", response.statusCode);
        }
        span.recordException(error instanceof Error ? error : String(error));
        span.setAttribute(
          "error.type",
          error instanceof Error && error.constructor.name ? error.constructor.name : "_OTHER"
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

function getRequestPath(requestUrl: string | undefined): string {
  try {
    return new URL(requestUrl ?? "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value?.split(",", 1)[0];
  const trimmed = firstValue?.trim();
  return trimmed || undefined;
}

function getHttpServerAttributes(
  request: IncomingMessage,
  method: string,
  originalMethod: string,
  path: string,
  route: string | undefined
): Attributes {
  const forwardedScheme = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const encrypted = "encrypted" in request.socket && request.socket.encrypted === true;
  const scheme = forwardedScheme === "http" || forwardedScheme === "https"
    ? forwardedScheme
    : encrypted
      ? "https"
      : "http";
  const authority =
    firstHeaderValue(request.headers["x-forwarded-host"]) ??
    firstHeaderValue(request.headers.host);
  const attributes: Attributes = {
    "http.request.method": method,
    "url.path": path,
    "url.scheme": scheme,
  };

  if (method === "_OTHER") attributes["http.request.method_original"] = originalMethod;
  if (route) attributes["http.route"] = route;
  if (request.httpVersion) attributes["network.protocol.version"] = request.httpVersion;

  if (authority) {
    try {
      const serverUrl = new URL(`${scheme}://${authority}`);
      attributes["server.address"] = serverUrl.hostname;
      if (serverUrl.port) attributes["server.port"] = Number(serverUrl.port);
    } catch {
      // Ignore an invalid Host header rather than recording untrusted malformed data.
    }
  }

  return attributes;
}

function dispatchManagedRequest(
  server: Server,
  request: IncomingMessage,
  response: ServerResponse
): Promise<{ completed: boolean; errorType?: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      request.off("aborted", abort);
      response.off("finish", finish);
      response.off("close", close);
      response.off("error", fail);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ completed: true });
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const disconnect = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ completed: false, errorType: "client_disconnect" });
    };
    const abort = () => disconnect();
    const close = () => {
      if (response.writableFinished) finish();
      else disconnect();
    };

    request.once("aborted", abort);
    response.once("finish", finish);
    response.once("close", close);
    response.once("error", fail);
    try {
      if (!server.emit("request", request, response)) {
        fail(new Error("HTTP server has no request listener"));
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
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

if (!process.env.VERCEL && !process.env.MCP_MANAGED_ENTRYPOINT && isDirectExecution()) {
  main().catch((err) => {
    logger.error("Fatal error", { error: String(err) });
    process.exit(1);
  });
}
