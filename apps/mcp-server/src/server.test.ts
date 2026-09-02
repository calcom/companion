import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  main: vi.fn().mockResolvedValue(undefined),
  register: vi.fn(),
}));

vi.mock("../instrumentation.js", () => ({ register: mocks.register }));
vi.mock("./index.js", () => ({ main: mocks.main }));

describe("Vercel native Node server entrypoint", () => {
  afterEach(() => {
    delete process.env.MCP_TRANSPORT;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("registers telemetry before starting the HTTP server", async () => {
    await import("../server.js");

    expect(process.env.MCP_TRANSPORT).toBe("http");
    expect(mocks.register).toHaveBeenCalledOnce();
    expect(mocks.main).toHaveBeenCalledOnce();
    expect(mocks.register.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.main.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });
});
