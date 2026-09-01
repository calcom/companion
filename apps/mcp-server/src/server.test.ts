import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  events: [] as string[],
  startHttpServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vercel/otel", () => ({
  registerOTel: vi.fn(() => state.events.push("instrumentation")),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, realpathSync: vi.fn(() => "/bundle.js") };
});

vi.mock("./config.js", () => {
  state.events.push("application-module");
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

describe("Vercel Node server entrypoint", () => {
  afterEach(() => {
    delete process.env.MCP_MANAGED_ENTRYPOINT;
    delete process.env.MCP_TRANSPORT;
  });

  it("initializes telemetry before the application and starts a bundled entrypoint once", async () => {
    vi.resetModules();
    state.events.length = 0;
    state.startHttpServer.mockClear();

    await import("./server.js");

    expect(state.events).toEqual(["instrumentation", "application-module"]);
    expect(state.startHttpServer).toHaveBeenCalledOnce();
    expect(process.env.MCP_MANAGED_ENTRYPOINT).toBe("vercel");
    expect(process.env.MCP_TRANSPORT).toBe("http");
  });
});
