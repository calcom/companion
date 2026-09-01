import "./instrumentation.js";

// Vercel deployments always use the remote HTTP transport. A dynamic import is
// intentional: it guarantees telemetry registration completes before modules
// that use fetch or OpenTelemetry are evaluated.
process.env.MCP_TRANSPORT = "http";
const { main } = await import("./index.js");
await main();
