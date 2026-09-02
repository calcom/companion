import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const extractedContext = { name: "vercel-request-context" };
  const span = {
    end: vi.fn(),
    recordException: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
  };
  const startActiveSpan = vi.fn(
    (_name: string, _options: unknown, callback: (activeSpan: typeof span) => unknown) =>
      callback(span)
  );
  return {
    contextWith: vi.fn((_context: unknown, callback: () => unknown) => callback()),
    extract: vi.fn(() => extractedContext),
    extractedContext,
    span,
    startActiveSpan,
  };
});

vi.mock("@opentelemetry/api", () => ({
  context: { with: state.contextWith },
  propagation: { extract: state.extract },
  ROOT_CONTEXT: { name: "root-context" },
  SpanKind: { SERVER: 1 },
  SpanStatusCode: { ERROR: 2 },
  trace: { getTracer: () => ({ startActiveSpan: state.startActiveSpan }) },
}));

import { traceHttpRequest } from "./http-telemetry.js";

function createRequest(url = "/health?probe=true", method = "GET"): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    headers: {
      host: "internal.vercel.local",
      traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
      "x-forwarded-host": "mcp.example.com",
      "x-forwarded-proto": "https",
    },
    httpVersion: "1.1",
    method,
    socket: { encrypted: false },
    url,
  }) as IncomingMessage;
}

function createResponse(): ServerResponse {
  return Object.assign(new EventEmitter(), {
    headersSent: false,
    statusCode: 200,
    writableFinished: false,
  }) as ServerResponse;
}

describe("Node HTTP server telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues the Vercel context with a stable HTTP server span", async () => {
    const request = createRequest();
    const response = createResponse();

    await traceHttpRequest(request, response, async () => {
      response.headersSent = true;
      response.writableFinished = true;
      response.emit("finish");
    });

    expect(state.extract).toHaveBeenCalledWith(
      { name: "root-context" },
      request.headers,
      expect.objectContaining({ get: expect.any(Function), keys: expect.any(Function) })
    );
    expect(state.contextWith).toHaveBeenCalledWith(state.extractedContext, expect.any(Function));
    expect(state.startActiveSpan).toHaveBeenCalledWith(
      "GET /health",
      {
        kind: 1,
        attributes: {
          "http.request.method": "GET",
          "http.route": "/health",
          "network.protocol.version": "1.1",
          "server.address": "mcp.example.com",
          "url.path": "/health",
          "url.scheme": "https",
        },
      },
      expect.any(Function)
    );
    expect(state.span.setAttribute).toHaveBeenCalledWith("http.response.status_code", 200);
    expect(state.span.end).toHaveBeenCalledOnce();
  });

  it("marks 5xx responses as server span errors", async () => {
    const request = createRequest("/mcp", "POST");
    const response = createResponse();

    await traceHttpRequest(request, response, async () => {
      response.statusCode = 503;
      response.headersSent = true;
      response.writableFinished = true;
      response.emit("finish");
    });

    expect(state.span.setAttribute).toHaveBeenCalledWith("http.response.status_code", 503);
    expect(state.span.setAttribute).toHaveBeenCalledWith("error.type", "503");
    expect(state.span.setStatus).toHaveBeenCalledWith({ code: 2 });
  });

  it("avoids high-cardinality route names and preserves unknown methods", async () => {
    const request = createRequest("/unmatched/customer-123?token=secret", "BREW");
    const response = createResponse();

    await traceHttpRequest(request, response, async () => {
      response.writableFinished = true;
      response.emit("finish");
    });

    expect(state.startActiveSpan).toHaveBeenCalledWith(
      "HTTP",
      expect.objectContaining({
        attributes: expect.objectContaining({
          "http.request.method": "_OTHER",
          "http.request.method_original": "BREW",
          "url.path": "/unmatched/customer-123",
        }),
      }),
      expect.any(Function)
    );
    const attributes = state.startActiveSpan.mock.calls[0]?.[1] as { attributes: object };
    expect(attributes.attributes).not.toHaveProperty("http.route");
  });

  it("records an interrupted response as a low-cardinality transport error", async () => {
    const request = createRequest("/mcp", "POST");
    const response = createResponse();
    let releaseHandler: () => void = () => {};
    const handler = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });

    const traced = traceHttpRequest(request, response, () => handler);
    response.emit("close");
    releaseHandler();

    await expect(traced).resolves.toBeUndefined();
    expect(state.span.setAttribute).toHaveBeenCalledWith("error.type", "client_disconnect");
    expect(state.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(state.span.end).toHaveBeenCalledOnce();
  });

  it("records handler exceptions and rethrows them to the server error boundary", async () => {
    const request = createRequest();
    const response = createResponse();
    const error = new TypeError("broken handler");

    await expect(
      traceHttpRequest(request, response, async () => {
        throw error;
      })
    ).rejects.toBe(error);

    expect(state.span.recordException).toHaveBeenCalledWith(error);
    expect(state.span.setAttribute).toHaveBeenCalledWith("error.type", "TypeError");
    expect(state.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(state.span.end).toHaveBeenCalledOnce();
  });
});
