import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  main: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./index.js", () => ({ main: mocks.main }));

describe("Vercel native Node server entrypoint", () => {
  afterEach(() => {
    delete process.env.MCP_TRANSPORT;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("starts the application in HTTP mode", async () => {
    await import("../server.js");

    expect(process.env.MCP_TRANSPORT).toBe("http");
    expect(mocks.main).toHaveBeenCalledOnce();
  });
});
