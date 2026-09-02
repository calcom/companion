import { register } from "./instrumentation.js";

// Vercel detects this project-root file as a native Node server. Register
// telemetry before importing application modules so outgoing fetches inherit
// the request span.
register();
process.env.MCP_TRANSPORT = "http";

const { main } = await import("./src/index.js");
await main();
