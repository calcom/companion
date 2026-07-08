/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414) and
 * Protected Resource Metadata (RFC 9728) for MCP spec compliance.
 */

export interface OAuthServerConfig {
  /** Public URL of the MCP server (e.g. https://mcp.example.com) */
  serverUrl: string;
}

/**
 * Build OAuth Authorization Server metadata per RFC 8414.
 * Returned at GET /.well-known/oauth-authorization-server
 */
export function buildAuthorizationServerMetadata(
  config: OAuthServerConfig
): Record<string, unknown> {
  const serverUrl = config.serverUrl.replace(/\/+$/, "");
  return {
    issuer: serverUrl,
    authorization_endpoint: `${serverUrl}/oauth/authorize`,
    token_endpoint: `${serverUrl}/oauth/token`,
    registration_endpoint: `${serverUrl}/oauth/register`,
    revocation_endpoint: `${serverUrl}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/**
 * Build Protected Resource Metadata per RFC 9728.
 * Returned at GET /.well-known/oauth-protected-resource
 */
export function buildProtectedResourceMetadata(config: OAuthServerConfig): Record<string, unknown> {
  const serverUrl = config.serverUrl.replace(/\/+$/, "");
  return {
    // resource is the server identifier (base URL). Per RFC 9728 §3 the client constructs
    // the discovery URL as "https://host/.well-known/oauth-protected-resource" — no path
    // suffix — so resource must stay as the base URL, not the /mcp endpoint path.
    resource: serverUrl,
    authorization_servers: [serverUrl],
    bearer_methods_supported: ["header"],
  };
}

/** Kind of OAuth discovery metadata a request path maps to. */
export type OAuthMetadataKind = "authorization-server" | "protected-resource";

const OAUTH_METADATA_NAMES: Record<OAuthMetadataKind, string> = {
  "authorization-server": "oauth-authorization-server",
  "protected-resource": "oauth-protected-resource",
};

/**
 * Match a request path against the OAuth discovery well-known locations.
 *
 * MCP clients derive the well-known URL from the server URL they were given.
 * When that URL carries a path (e.g. `https://mcp.cal.com/mcp`), clients probe
 * the "path-aware" layouts from RFC 9728 (protected resource) and RFC 8414
 * (authorization server) in addition to the plain root layout:
 *
 *   - `/.well-known/<name>`       (root)
 *   - `/.well-known/<name>/mcp`   (well-known inserted before the resource path)
 *   - `/mcp/.well-known/<name>`   (well-known appended after the resource path)
 *
 * We serve identical metadata for all three so discovery succeeds whether the
 * user configured the base URL or the `/mcp` endpoint. Returning 404 for the
 * `/mcp`-scoped variants breaks connectors (e.g. Claude) that only probe the
 * path-aware URL, surfacing as "Couldn't register with cal.com's sign-in service".
 */
export function matchOAuthMetadataPath(pathname: string): OAuthMetadataKind | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  for (const kind of Object.keys(OAUTH_METADATA_NAMES) as OAuthMetadataKind[]) {
    const name = OAUTH_METADATA_NAMES[kind];
    if (
      normalized === `/.well-known/${name}` ||
      normalized === `/.well-known/${name}/mcp` ||
      normalized === `/mcp/.well-known/${name}`
    ) {
      return kind;
    }
  }
  return undefined;
}
