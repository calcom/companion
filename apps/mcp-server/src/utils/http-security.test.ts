import { describe, expect, it } from "vitest";
import { resolveCorsOrigin } from "./http-security.js";

describe("resolveCorsOrigin", () => {
  it("uses the configured CORS origin when present", () => {
    expect(resolveCorsOrigin("https://client.example", "https://mcp.example.com")).toBe(
      "https://client.example"
    );
  });

  it("defaults to the MCP server origin instead of wildcard", () => {
    expect(resolveCorsOrigin(undefined, "https://mcp.example.com/mcp")).toBe(
      "https://mcp.example.com"
    );
  });
});
