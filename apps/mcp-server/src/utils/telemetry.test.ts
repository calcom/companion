import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const span = {
    end: vi.fn(),
    recordException: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
  };
  const startActiveSpan = vi.fn(
    async (
      _name: string,
      _options: unknown,
      callback: (activeSpan: typeof span) => Promise<unknown>
    ) => callback(span)
  );
  return { span, startActiveSpan };
});

vi.mock("@opentelemetry/api", () => ({
  SpanKind: { SERVER: 1 },
  SpanStatusCode: { ERROR: 2 },
  trace: {
    getTracer: () => ({ startActiveSpan: mocks.startActiveSpan }),
  },
}));

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { instrumentMcpTransport, instrumentToolHandler } from "./telemetry.js";

function createTransport(): Transport {
  return {
    start: vi.fn(async () => {}),
    send: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

describe("instrumentMcpTransport", () => {
  beforeEach(() => {
    mocks.span.end.mockClear();
    mocks.span.recordException.mockClear();
    mocks.span.setAttribute.mockClear();
    mocks.span.setStatus.mockClear();
    mocks.startActiveSpan.mockClear();
  });

  it.each([
    "initialize",
    "tools/list",
  ])("traces %s until its JSON-RPC response is sent", async (method) => {
    const transport = createTransport();
    const instrumented = instrumentMcpTransport(transport);
    const forwarded: JSONRPCMessage[] = [];
    instrumented.onmessage = (message) => forwarded.push(message);
    await instrumented.start();

    const request = { jsonrpc: "2.0" as const, id: 42, method };
    transport.onmessage?.(request, {});

    expect(forwarded).toEqual([request]);
    expect(mocks.startActiveSpan).toHaveBeenCalledWith(
      method,
      {
        kind: 1,
        attributes: { "mcp.method.name": method },
      },
      expect.any(Function)
    );
    expect(mocks.span.end).not.toHaveBeenCalled();

    await instrumented.send({ jsonrpc: "2.0", id: 42, result: {} });

    expect(transport.send).toHaveBeenCalledOnce();
    expect(mocks.span.end).toHaveBeenCalledOnce();
  });

  it("records the negotiated protocol version on initialize and later operations", async () => {
    const transport = createTransport();
    const instrumented = instrumentMcpTransport(transport);
    instrumented.onmessage = vi.fn();
    await instrumented.start();

    transport.onmessage?.({ jsonrpc: "2.0", id: 1, method: "initialize" }, {});
    await instrumented.send({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: "2025-11-25" },
    });
    transport.onmessage?.({ jsonrpc: "2.0", id: 2, method: "tools/list" }, {});

    expect(mocks.span.setAttribute).toHaveBeenCalledWith("mcp.protocol.version", "2025-11-25");
    expect(mocks.startActiveSpan).toHaveBeenLastCalledWith(
      "tools/list",
      {
        kind: 1,
        attributes: {
          "mcp.method.name": "tools/list",
          "mcp.protocol.version": "2025-11-25",
        },
      },
      expect.any(Function)
    );
  });

  it("marks JSON-RPC errors without recording their message", async () => {
    const transport = createTransport();
    const instrumented = instrumentMcpTransport(transport);
    instrumented.onmessage = vi.fn();
    await instrumented.start();

    transport.onmessage?.({ jsonrpc: "2.0", id: "list-1", method: "tools/list" }, {});
    await instrumented.send({
      jsonrpc: "2.0",
      id: "list-1",
      error: { code: -32603, message: "sensitive internal detail" },
    });

    expect(mocks.span.setAttribute.mock.calls).toEqual([["error.type", "-32603"]]);
    expect(mocks.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(mocks.span.recordException).not.toHaveBeenCalled();
    expect(mocks.span.end).toHaveBeenCalledOnce();
  });

  it("forwards other MCP messages without creating a span", async () => {
    const transport = createTransport();
    const instrumented = instrumentMcpTransport(transport);
    instrumented.onmessage = vi.fn();
    await instrumented.start();

    transport.onmessage?.(
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_me" } },
      {}
    );

    expect(instrumented.onmessage).toHaveBeenCalledOnce();
    expect(mocks.startActiveSpan).not.toHaveBeenCalled();
  });
});

describe("instrumentToolHandler", () => {
  beforeEach(() => {
    mocks.span.end.mockClear();
    mocks.span.recordException.mockClear();
    mocks.span.setAttribute.mockClear();
    mocks.span.setStatus.mockClear();
    mocks.startActiveSpan.mockClear();
  });

  it("records only bounded tool metadata and successful completion", async () => {
    const handler = vi.fn(async (input: { email: string }) => ({ content: input.email }));
    const instrumented = instrumentToolHandler("get_me", handler);

    await expect(instrumented({ email: "private@example.com" })).resolves.toEqual({
      content: "private@example.com",
    });

    expect(mocks.startActiveSpan).toHaveBeenCalledWith(
      "tools/call get_me",
      {
        kind: 1,
        attributes: {
          "mcp.method.name": "tools/call",
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": "get_me",
        },
      },
      expect.any(Function)
    );
    expect(mocks.span.setStatus).not.toHaveBeenCalled();
    expect(mocks.span.setAttribute).not.toHaveBeenCalled();
    expect(mocks.span.recordException).not.toHaveBeenCalled();
    expect(mocks.span.end).toHaveBeenCalledOnce();
  });

  it("marks failures without attaching exception details", async () => {
    const failure = new Error("secret upstream response");
    const instrumented = instrumentToolHandler("create_booking", async () => {
      throw failure;
    });

    await expect(instrumented()).rejects.toBe(failure);

    expect(mocks.span.setAttribute.mock.calls).toEqual([["error.type", "Error"]]);
    expect(mocks.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(mocks.span.recordException).not.toHaveBeenCalled();
    expect(mocks.span.end).toHaveBeenCalledOnce();
  });

  it("marks MCP error results as failures", async () => {
    const instrumented = instrumentToolHandler("get_me", async () => ({
      content: [{ type: "text", text: "safe client-facing error" }],
      isError: true,
    }));

    await instrumented();

    expect(mocks.span.setAttribute).toHaveBeenCalledWith("error.type", "tool_error");
    expect(mocks.span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(mocks.span.end).toHaveBeenCalledOnce();
  });
});
