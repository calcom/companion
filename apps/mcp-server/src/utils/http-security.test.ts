import { describe, expect, it } from "vitest";
import { applyCorsHeaders, resolveCorsOrigin } from "./http-security.js";

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

describe("applyCorsHeaders", () => {
  it("allows MCP browser client preflight headers", () => {
    const headers = new Map<string, string>();

    applyCorsHeaders(
      {
        setHeader(name, value) {
          headers.set(name, value);
        },
      },
      "https://client.example"
    );

    expect(headers.get("Access-Control-Allow-Origin")).toBe("https://client.example");
    expect(headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, DELETE, OPTIONS");
    expect(headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version, last-event-id"
    );
    expect(headers.get("Access-Control-Expose-Headers")).toBe("Mcp-Session-Id");
    expect(headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(headers.get("Vary")).toBe("Origin");
  });
});
