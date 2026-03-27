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
export function buildAuthorizationServerMetadata(config: OAuthServerConfig): Record<string, unknown> {
  const { serverUrl } = config;
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
  const { serverUrl } = config;
  return {
    resource: serverUrl,
    authorization_servers: [serverUrl],
    bearer_methods_supported: ["header"],
  };
}
