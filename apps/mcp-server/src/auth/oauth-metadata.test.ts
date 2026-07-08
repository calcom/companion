import { describe, it, expect } from "vitest";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  matchOAuthMetadataPath,
} from "./oauth-metadata.js";

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

describe("matchOAuthMetadataPath", () => {
  it("matches the root authorization-server well-known path", () => {
    expect(matchOAuthMetadataPath("/.well-known/oauth-authorization-server")).toBe(
      "authorization-server"
    );
  });

  it("matches the root protected-resource well-known path", () => {
    expect(matchOAuthMetadataPath("/.well-known/oauth-protected-resource")).toBe(
      "protected-resource"
    );
  });

  it("matches path-aware variants with the well-known before the /mcp path (RFC 9728/8414)", () => {
    expect(matchOAuthMetadataPath("/.well-known/oauth-protected-resource/mcp")).toBe(
      "protected-resource"
    );
    expect(matchOAuthMetadataPath("/.well-known/oauth-authorization-server/mcp")).toBe(
      "authorization-server"
    );
  });

  it("matches path-aware variants with the well-known after the /mcp path", () => {
    expect(matchOAuthMetadataPath("/mcp/.well-known/oauth-protected-resource")).toBe(
      "protected-resource"
    );
    expect(matchOAuthMetadataPath("/mcp/.well-known/oauth-authorization-server")).toBe(
      "authorization-server"
    );
  });

  it("tolerates trailing slashes", () => {
    expect(matchOAuthMetadataPath("/.well-known/oauth-protected-resource/")).toBe(
      "protected-resource"
    );
    expect(matchOAuthMetadataPath("/.well-known/oauth-protected-resource/mcp/")).toBe(
      "protected-resource"
    );
  });

  it("does not match unrelated paths", () => {
    expect(matchOAuthMetadataPath("/mcp")).toBeUndefined();
    expect(matchOAuthMetadataPath("/")).toBeUndefined();
    expect(matchOAuthMetadataPath("/oauth/register")).toBeUndefined();
    expect(matchOAuthMetadataPath("/.well-known/openid-configuration")).toBeUndefined();
    expect(matchOAuthMetadataPath("/.well-known/oauth-protected-resource/other")).toBeUndefined();
  });
});
