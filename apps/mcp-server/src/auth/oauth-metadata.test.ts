import { describe, it, expect } from "vitest";
import { buildAuthorizationServerMetadata, buildProtectedResourceMetadata } from "./oauth-metadata.js";

const config = { serverUrl: "https://mcp.example.com" };

describe("buildAuthorizationServerMetadata", () => {
  it("returns correct OAuth AS metadata", () => {
    const metadata = buildAuthorizationServerMetadata(config);
    expect(metadata.issuer).toBe("https://mcp.example.com");
    expect(metadata.authorization_endpoint).toBe("https://mcp.example.com/oauth/authorize");
    expect(metadata.token_endpoint).toBe("https://mcp.example.com/oauth/token");
    expect(metadata.registration_endpoint).toBe("https://mcp.example.com/oauth/register");
    expect(metadata.revocation_endpoint).toBe("https://mcp.example.com/oauth/revoke");
    expect(metadata.response_types_supported).toEqual(["code"]);
    expect(metadata.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
  });
});

describe("buildProtectedResourceMetadata", () => {
  it("returns correct protected resource metadata", () => {
    const metadata = buildProtectedResourceMetadata(config);
    expect(metadata.resource).toBe("https://mcp.example.com");
    expect(metadata.authorization_servers).toEqual(["https://mcp.example.com"]);
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
  });
});
