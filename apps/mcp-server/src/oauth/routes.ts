import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPendingAuth, consumePendingAuth } from "./state-store.js";
import {
  createOAuthConnection,
  getOAuthConnectionsByTenant,
  deleteOAuthConnection,
} from "../storage/oauth-connections-repo.js";

function getBaseUrl(): string {
  return process.env.CAL_API_BASE_URL || "https://api.cal.com";
}

function getClientId(): string {
  const id = process.env.CAL_OAUTH_CLIENT_ID;
  if (!id) throw new Error("CAL_OAUTH_CLIENT_ID is required for hosted OAuth");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.CAL_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("CAL_OAUTH_CLIENT_SECRET is required for hosted OAuth");
  return secret;
}

function getCallbackUrl(): string {
  const base = process.env.OAUTH_CALLBACK_URL || `http://localhost:${process.env.PORT || "3100"}`;
  return `${base}/oauth/callback`;
}

function parseUrl(req: IncomingMessage): URL {
  const host = req.headers.host || "localhost";
  return new URL(req.url || "/", `http://${host}`);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * GET /oauth/start?tenantId=xxx
 * Generates PKCE challenge + state, redirects to Cal.com authorize URL.
 */
function handleOAuthStart(req: IncomingMessage, res: ServerResponse): void {
  const url = parseUrl(req);
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) {
    sendJson(res, 400, { error: "tenantId query parameter is required" });
    return;
  }

  const redirectUri = getCallbackUrl();
  const pending = createPendingAuth(tenantId, redirectUri);
  const clientId = getClientId();
  const baseUrl = getBaseUrl();

  const authorizeUrl = new URL(`/v2/oauth/${clientId}/authorize`, baseUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", pending.state);
  authorizeUrl.searchParams.set("code_challenge", pending.codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}

/**
 * GET /oauth/callback?code=xxx&state=xxx
 * Validates state, exchanges code for tokens, stores connection.
 */
async function handleOAuthCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = parseUrl(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    sendJson(res, 400, { error: `OAuth error: ${error}` });
    return;
  }

  if (!code || !state) {
    sendJson(res, 400, { error: "Missing code or state parameter" });
    return;
  }

  const pending = consumePendingAuth(state);
  if (!pending) {
    sendJson(res, 400, { error: "Invalid or expired state parameter" });
    return;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const baseUrl = getBaseUrl();
  const tokenUrl = `${baseUrl}/v2/oauth/${clientId}/exchange`;

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_secret: clientSecret,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.codeVerifier,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("[oauth] Token exchange failed:", tokenRes.status, body);
    sendJson(res, 502, { error: "Token exchange failed" });
    return;
  }

  const tokens = (await tokenRes.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  };

  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;

  const connection = createOAuthConnection({
    tenantId: pending.tenantId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  });

  sendJson(res, 200, {
    status: "connected",
    connectionId: connection.id,
    tenantId: connection.tenantId,
  });
}

/**
 * GET /oauth/connections?tenantId=xxx
 * List connections for a tenant (does not expose tokens).
 */
function handleListConnections(req: IncomingMessage, res: ServerResponse): void {
  const url = parseUrl(req);
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) {
    sendJson(res, 400, { error: "tenantId query parameter is required" });
    return;
  }

  const connections = getOAuthConnectionsByTenant(tenantId);
  sendJson(res, 200, {
    connections: connections.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      calUserId: c.calUserId,
      expiresAt: c.expiresAt,
      scopes: c.scopes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

/**
 * DELETE /oauth/connections/:id
 * Disconnect and delete a connection.
 */
function handleDeleteConnection(res: ServerResponse, connectionId: string): void {
  deleteOAuthConnection(connectionId);
  sendJson(res, 200, { status: "disconnected", connectionId });
}

/**
 * Simple request router for the OAuth HTTP server.
 */
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = parseUrl(req);
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/oauth/start") {
    handleOAuthStart(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/oauth/callback") {
    handleOAuthCallback(req, res).catch((err) => {
      console.error("[oauth] Callback error:", err);
      sendJson(res, 500, { error: "Internal server error" });
    });
    return;
  }

  if (method === "GET" && url.pathname === "/oauth/connections") {
    handleListConnections(req, res);
    return;
  }

  // DELETE /oauth/connections/:id
  const deleteMatch = url.pathname.match(/^\/oauth\/connections\/([^/]+)$/);
  if (method === "DELETE" && deleteMatch) {
    handleDeleteConnection(res, deleteMatch[1]);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

/**
 * Start the OAuth HTTP server on the given port.
 */
export function startOAuthServer(port: number): void {
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.error(`[oauth] HTTP server listening on port ${port}`);
  });
}
