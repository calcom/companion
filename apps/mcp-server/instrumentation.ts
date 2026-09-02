import { registerOTel } from "@vercel/otel";

const OTEL_REGISTERED_KEY = "__calcomMcpOtelRegistered";

/** Register the MCP server's OpenTelemetry instrumentation with Vercel. */
export function register(): void {
  const registrationState = globalThis as Record<string, unknown>;
  if (registrationState[OTEL_REGISTERED_KEY]) return;

  registerOTel({
    serviceName: "cal-mcp-server",
    instrumentations: ["fetch"],
  });
  registrationState[OTEL_REGISTERED_KEY] = true;
  console.info("[otel] registered cal-mcp-server with fetch instrumentation");
}
