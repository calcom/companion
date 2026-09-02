import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const server = { emit: vi.fn() };
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
    registerOTel: vi.fn(),
    server,
    span,
    startActiveSpan,
    startHttpServer: vi.fn().mockResolvedValue(server),
  };
});

const OTEL_REGISTERED_KEY = "__calcomMcpOtelRegistered";

vi.mock("@vercel/otel", () => ({ registerOTel: state.registerOTel }));

vi.mock("@opentelemetry/api", () => ({
  context: { with: state.contextWith },
  propagation: { extract: state.extract },
  ROOT_CONTEXT: { name: "root-context" },
  SpanKind: { SERVER: 1 },
  SpanStatusCode: { ERROR: 2 },
  trace: { getTracer: () => ({ startActiveSpan: state.startActiveSpan }) },
}));

vi.mock("./config.js", () => {
  return {
    loadConfig: vi.fn(() => ({
      transport: "http",
      port: 3100,
      serverUrl: "https://mcp.example.com",
      logLevel: "error",
    })),
  };
});

vi.mock("./http-server.js", () => ({ startHttpServer: state.startHttpServer }));

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

describe("Vercel Node server entrypoint", () => {
  beforeEach(() => {
    process.env.VERCEL = "1";
    delete (globalThis as Record<string, unknown>)[OTEL_REGISTERED_KEY];
    vi.resetModules();
    state.registerOTel.mockClear();
    state.server.emit.mockClear();
    state.contextWith.mockClear();
    state.extract.mockClear();
    state.span.end.mockClear();
    state.span.recordException.mockClear();
    state.span.setAttribute.mockClear();
    state.span.setStatus.mockClear();
    state.startActiveSpan.mockClear();
    state.startHttpServer.mockClear();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[OTEL_REGISTERED_KEY];
    delete process.env.VERCEL;
    delete process.env.MCP_MANAGED_ENTRYPOINT;
    delete process.env.MCP_TRANSPORT;
  });

  it("exports the application root as a lazy handler without binding a local port", async () => {
    const { default: handler } = await import("./index.js");

    expect(handler).toBeTypeOf("function");
    expect(state.startHttpServer).not.toHaveBeenCalled();

    const request = createRequest();
    const response = createResponse();
    state.server.emit.mockImplementationOnce((_event, _request, emittedResponse) => {
      (emittedResponse as ServerResponse).statusCode = 200;
      (emittedResponse as ServerResponse).emit("finish");
      return true;
    });
    await handler(request, response);

    expect(state.registerOTel).toHaveBeenCalledWith({
      serviceName: "cal-mcp-server",
      instrumentations: ["fetch"],
    });
    expect(process.env.MCP_MANAGED_ENTRYPOINT).toBe("vercel");
    expect(process.env.MCP_TRANSPORT).toBe("http");
    expect(state.startHttpServer).toHaveBeenCalledOnce();
    expect(state.startHttpServer).toHaveBeenCalledWith(expect.any(Function), expect.any(Object), {
      listen: false,
    });
    expect(state.extract).toHaveBeenCalledWith(
      { name: "root-context" },
      request.headers,
      expect.objectContaining({ get: expect.any(Function), keys: expect.any(Function) })
    );
    expect(state.contextWith).toHaveBeenCalledWith(state.extractedContext, expect.any(Function));
    expect(state.startActiveSpan).toHaveBeenCalledWith(
      "GET /health",
      expect.objectContaining({
        kind: 1,
        attributes: {
          "http.request.method": "GET",
          "http.route": "/health",
          "network.protocol.version": "1.1",
          "server.address": "mcp.example.com",
          "url.path": "/health",
          "url.scheme": "https",
        },
      }),
      expect.any(Function)
    );
    expect(state.startActiveSpan.mock.invocationCallOrder[0]).toBeLessThan(
      state.startHttpServer.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(state.server.emit).toHaveBeenCalledWith("request", request, response);
    expect(state.span.setAttribute).toHaveBeenCalledWith("http.response.status_code", 200);
    expect(state.span.end).toHaveBeenCalledOnce();
  });

  it("marks 5xx responses as server span errors", async () => {
    const { default: handler } = await import("./index.js");
    const request = createRequest("/mcp", "POST");
    const response = createResponse();
    state.server.emit.mockImplementationOnce((_event, _request, emittedResponse) => {
      (emittedResponse as ServerResponse).statusCode = 503;
      (emittedResponse as ServerResponse).emit("finish");
      return true;
    });

    await handler(request, response);

    expect(state.span.setAttribute).toHaveBeenCalledWith("http.response.status_code", 503);
    expect(state.span.setAttribute).toHaveBeenCalledWith("error.type", "503");
    expect(state.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(state.span.end).toHaveBeenCalledOnce();
  });

  it("avoids high-cardinality route names and preserves unknown methods", async () => {
    const { default: handler } = await import("./index.js");
    const request = createRequest("/unmatched/customer-123?token=secret", "BREW");
    const response = createResponse();
    state.server.emit.mockImplementationOnce((_event, _request, emittedResponse) => {
      (emittedResponse as ServerResponse).emit("finish");
      return true;
    });

    await handler(request, response);

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
    const { default: handler } = await import("./index.js");
    const request = createRequest("/mcp", "POST");
    const response = createResponse();
    state.server.emit.mockReturnValueOnce(true);

    const handlerPromise = handler(request, response);
    await vi.waitFor(() => expect(state.server.emit).toHaveBeenCalledOnce());
    response.emit("close");

    await expect(handlerPromise).resolves.toBeUndefined();
    expect(state.span.setAttribute).toHaveBeenCalledWith("error.type", "client_disconnect");
    expect(state.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(state.span.end).toHaveBeenCalledOnce();
  });
});
