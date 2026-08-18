/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414) and
 * Protected Resource Metadata (RFC 9728) for MCP spec compliance.
 */

export interface OAuthServerConfig {
  /** Public URL of the MCP server (e.g. https://mcp.example.com) */
  serverUrl: string;
}

/** Return the canonical protected resource URL for this server's MCP endpoint. */
export function getMcpResourceUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, "")}/mcp`;
}

/**
 * Derive the RFC 9728 metadata URL for a protected resource.
 *
 * For a resource at `https://mcp.example.com/mcp`, metadata lives at
 * `https://mcp.example.com/.well-known/oauth-protected-resource/mcp`.
 */
export function getProtectedResourceMetadataUrl(resourceUrl: string): string {
  const resource = new URL(resourceUrl);
  const resourcePath = resource.pathname === "/" ? "" : resource.pathname;
  return `${resource.origin}/.well-known/oauth-protected-resource${resourcePath}${resource.search}`;
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
export function buildProtectedResourceMetadata(
  config: OAuthServerConfig,
  resourceUrl = config.serverUrl
): Record<string, unknown> {
  const serverUrl = config.serverUrl.replace(/\/+$/, "");
  return {
    resource: resourceUrl.replace(/\/+$/, ""),
    authorization_servers: [serverUrl],
    bearer_methods_supported: ["header"],
  };
}
