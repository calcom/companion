type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

export function resolveCorsOrigin(configuredOrigin: string | undefined, serverUrl: string): string {
  if (configuredOrigin) return configuredOrigin;
  return new URL(serverUrl).origin;
}

export function applyCorsHeaders(res: HeaderResponse, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  // The MCP browser client sends these custom headers; preflight must allow them.
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version, last-event-id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}
