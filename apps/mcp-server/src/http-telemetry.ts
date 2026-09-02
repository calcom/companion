import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
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

const requestTracer = trace.getTracer("@calcom/mcp-server", "0.1.0");
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

/** Trace one request handled by the real Node HTTP server. */
export function traceHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handleRequest: () => Promise<void>
): Promise<void> {
  const parentContext = propagation.extract(ROOT_CONTEXT, request.headers, incomingHeadersGetter);
  return context.with(parentContext, () => {
    const originalMethod = request.method ?? "GET";
    const method = KNOWN_HTTP_METHODS.has(originalMethod) ? originalMethod : "_OTHER";
    const path = getRequestPath(request.url);
    const route = HTTP_ROUTES.has(path) ? path : undefined;
    const spanMethod = method === "_OTHER" ? "HTTP" : method;
    const spanName = route ? `${spanMethod} ${route}` : spanMethod;
    const attributes = getHttpServerAttributes(request, method, originalMethod, path, route);

    return requestTracer.startActiveSpan(spanName, { kind: SpanKind.SERVER, attributes }, (span) =>
      runTracedRequest(request, response, handleRequest, span)
    );
  });
}

async function runTracedRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handleRequest: () => Promise<void>,
  span: Span
): Promise<void> {
  try {
    const completion = waitForResponse(request, response);
    await handleRequest();
    const result = response.writableFinished ? { completed: true as const } : await completion;

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

function waitForResponse(
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
  });
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
  const scheme =
    forwardedScheme === "http" || forwardedScheme === "https"
      ? forwardedScheme
      : encrypted
        ? "https"
        : "http";
  const authority =
    firstHeaderValue(request.headers["x-forwarded-host"]) ?? firstHeaderValue(request.headers.host);
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
