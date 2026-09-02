// Vercel detects this project-root file as a native Node server and invokes the
// project-root instrumentation hook before loading it.
process.env.MCP_TRANSPORT = "http";

const { main } = await import("./src/index.js");
await main();
