import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RequestId } from "@modelcontextprotocol/sdk/types.js";
import { type Span, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("@calcom/mcp-server", "0.1.0");
const TRACED_MCP_METHODS = new Set(["initialize", "tools/list"]);

function errorType(error: unknown): string {
  return error instanceof Error && error.constructor.name ? error.constructor.name : "_OTHER";
}

function markSpanError(span: Span, type: string): void {
  span.setAttribute("error.type", type);
  span.setStatus({ code: SpanStatusCode.ERROR });
}

/**
 * Add MCP server spans for protocol operations handled internally by the SDK.
 *
 * The SDK owns its request handlers and its message callback does not return the
 * handler promise. Wrapping the transport lets each span start when a request is
 * received and end after the matching JSON-RPC response has been sent.
 */
export function instrumentMcpTransport(transport: Transport): Transport {
  const activeRequests = new Map<RequestId, Span>();
  let protocolVersion: string | undefined;

  const wrappedTransport: Transport = {
    get sessionId() {
      return transport.sessionId;
    },
    setProtocolVersion: transport.setProtocolVersion
      ? (version: string) => transport.setProtocolVersion?.(version)
      : undefined,
    async start(): Promise<void> {
      const previousOnClose = transport.onclose;
      const previousOnError = transport.onerror;

      transport.onclose = () => {
        for (const span of activeRequests.values()) {
          markSpanError(span, "connection_closed");
          span.end();
        }
        activeRequests.clear();
        previousOnClose?.();
        wrappedTransport.onclose?.();
      };
      transport.onerror = (error) => {
        previousOnError?.(error);
        wrappedTransport.onerror?.(error);
      };
      transport.onmessage = (message, extra) => {
        if (
          !("method" in message) ||
          !("id" in message) ||
          message.id == null ||
          !TRACED_MCP_METHODS.has(message.method)
        ) {
          wrappedTransport.onmessage?.(message, extra);
          return;
        }

        const attributes: Record<string, string> = {
          "mcp.method.name": message.method,
        };
        if (protocolVersion) attributes["mcp.protocol.version"] = protocolVersion;

        tracer.startActiveSpan(
          message.method,
          { kind: SpanKind.SERVER, attributes },
          (span: Span) => {
            activeRequests.set(message.id, span);
            try {
              wrappedTransport.onmessage?.(message, extra);
            } catch (error) {
              activeRequests.delete(message.id);
              markSpanError(span, errorType(error));
              span.end();
              throw error;
            }
          }
        );
      };

      await transport.start();
    },
    async send(message, options): Promise<void> {
      const span =
        "id" in message && message.id != null && !("method" in message)
          ? activeRequests.get(message.id)
          : undefined;

      try {
        if (span && "result" in message) {
          const result = message.result;
          if (
            typeof result === "object" &&
            result !== null &&
            "protocolVersion" in result &&
            typeof result.protocolVersion === "string"
          ) {
            protocolVersion = result.protocolVersion;
            span.setAttribute("mcp.protocol.version", protocolVersion);
          }
        } else if (span && "error" in message) {
          markSpanError(span, String(message.error.code));
        }

        await transport.send(message, options);
      } catch (error) {
        if (span) markSpanError(span, errorType(error));
        throw error;
      } finally {
        if (span && "id" in message && message.id != null) {
          activeRequests.delete(message.id);
          span.end();
        }
      }
    },
    async close(): Promise<void> {
      await transport.close();
    },
  };

  return wrappedTransport;
}

/**
 * Add a bounded span around an MCP tool handler.
 *
 * Tool names come from the server's static registry. Arguments, results, user
 * identifiers, tokens, and exception details are deliberately not recorded.
 * Without an initialized OpenTelemetry SDK (the default for stdio and
 * self-hosted deployments), the API supplies a no-op tracer.
 */
export function instrumentToolHandler<TArgs extends unknown[], TResult>(
  toolName: string,
  handler: (...args: TArgs) => TResult | Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs): Promise<TResult> =>
    tracer.startActiveSpan(
      `tools/call ${toolName}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "mcp.method.name": "tools/call",
          "gen_ai.operation.name": "execute_tool",
          "gen_ai.tool.name": toolName,
        },
      },
      async (span: Span): Promise<TResult> => {
        try {
          const result = await handler(...args);
          const isMcpError =
            typeof result === "object" &&
            result !== null &&
            "isError" in result &&
            result.isError === true;
          if (isMcpError) {
            span.setAttribute("error.type", "tool_error");
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          return result;
        } catch (error) {
          markSpanError(span, errorType(error));
          throw error;
        } finally {
          span.end();
        }
      }
    );
}
