import { registerOTel } from "@vercel/otel";

/** Register the MCP server's OpenTelemetry instrumentation with Vercel. */
export function register(): void {
  registerOTel({
    serviceName: "cal-mcp-server",
    instrumentations: ["fetch"],
  });
  console.info("[otel] registered cal-mcp-server with fetch instrumentation");
}
