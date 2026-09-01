import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ events: [] as string[] }));

vi.mock("./instrumentation.js", () => {
  state.events.push("instrumentation");
  return {};
});

vi.mock("./index.js", () => {
  return {
    main: vi.fn(async () => {
      state.events.push("application");
    }),
  };
});

describe("Vercel Node server entrypoint", () => {
  afterEach(() => {
    delete process.env.MCP_TRANSPORT;
  });

  it("initializes telemetry before loading the HTTP application", async () => {
    delete process.env.MCP_TRANSPORT;
    await import("./server.js");

    expect(state.events).toEqual(["instrumentation", "application"]);
    expect(process.env.MCP_TRANSPORT).toBe("http");
  });
});
