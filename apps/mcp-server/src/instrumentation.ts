import { registerOTel } from "@vercel/otel";

/**
 * Register Vercel's supported OpenTelemetry setup for non-Next.js frameworks.
 * Self-hosted and stdio entry points do not load the project-root hook, so they
 * do not initialize an SDK.
 */
registerOTel({ serviceName: "cal-mcp-server" });
