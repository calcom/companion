import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ registerOTel: vi.fn() }));

vi.mock("@vercel/otel", () => ({ registerOTel: mocks.registerOTel }));

describe("Vercel OpenTelemetry instrumentation", () => {
  it("registers the MCP service with Vercel's supported setup", async () => {
    vi.resetModules();
    mocks.registerOTel.mockClear();
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const { register } = await import("../instrumentation.js");

    expect(mocks.registerOTel).not.toHaveBeenCalled();
    register();
    expect(mocks.registerOTel).toHaveBeenCalledOnce();
    expect(mocks.registerOTel).toHaveBeenCalledWith({
      serviceName: "cal-mcp-server",
      instrumentations: ["fetch"],
    });
    expect(consoleInfo).toHaveBeenCalledWith(
      "[otel] registered cal-mcp-server with fetch instrumentation"
    );
    consoleInfo.mockRestore();
  });
});
