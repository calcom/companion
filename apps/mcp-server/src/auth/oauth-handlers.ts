import type { IncomingMessage, ServerResponse } from "node:http";
import { generateCodeVerifier, generateCodeChallenge, generateState, verifyCodeChallenge } from "./pkce.js";
import {
  createRegisteredClient,
  getRegisteredClient,
  createPendingAuth,
  getPendingAuth,
  deletePendingAuth,
  createAuthCode,
  consumeAuthCode,
  createAccessToken,
  rotateAccessToken,
  deleteAccessToken,
  getAccessToken,
} from "../storage/token-store.js";

export interface OAuthConfig {
  /** Public URL of the MCP server */
  serverUrl: string;
  /** Cal.com OAuth client ID */
  calOAuthClientId: string;
  /** Cal.com OAuth client secret */
  calOAuthClientSecret: string;
  /** Cal.com API base URL (default: https://api.cal.com) */
  calApiBaseUrl: string;
  /** Cal.com app base URL for authorize redirect (default: https://app.cal.com) */
  calAppBaseUrl?: string;
}

/** Read the full request body as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Send a JSON response. */
function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ── Dynamic Client Registration (POST /oauth/register) ──

export async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "method_not_allowed" });
    return;
  }

  const raw = await readBody(req);
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "Invalid JSON body" });
    return;
  }

  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    jsonResponse(res, 400, {
      error: "invalid_request",
      error_description: "redirect_uris must be a non-empty array of URIs",
    });
    return;
  }

  const redirectUris = body.redirect_uris as string[];
  const clientName = typeof body.client_name === "string" ? body.client_name : undefined;

  const client = createRegisteredClient(redirectUris, clientName);

  jsonResponse(res, 201, {
    client_id: client.clientId,
    redirect_uris: client.redirectUris,
    client_name: client.clientName,
  });
}

// ── Authorization (GET /oauth/authorize) ──

export function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  config: OAuthConfig,
): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const clientState = url.searchParams.get("state");

  // Validate required params
  if (responseType !== "code") {
    jsonResponse(res, 400, { error: "unsupported_response_type" });
    return;
  }
  if (!clientId || !redirectUri || !codeChallenge || !clientState) {
    jsonResponse(res, 400, {
      error: "invalid_request",
      error_description: "Missing required parameters: client_id, redirect_uri, code_challenge, state",
    });
    return;
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "Only S256 code_challenge_method is supported" });
    return;
  }

  // Validate client registration
  const client = getRegisteredClient(clientId);
  if (!client) {
    jsonResponse(res, 400, { error: "invalid_client", error_description: "Unknown client_id" });
    return;
  }
  if (!client.redirectUris.includes(redirectUri)) {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "redirect_uri not registered for this client" });
    return;
  }

  // Generate internal state for Cal.com
  const internalState = generateState();

  // Only use PKCE for the Cal.com leg when we don't have a client_secret
  // (i.e., public client). Cal.com's token validator rejects requests that
  // contain both client_secret and code_verifier (forbidNonWhitelisted).
  const useCalPkce = !config.calOAuthClientSecret;
  const calCodeVerifier = useCalPkce ? generateCodeVerifier() : undefined;
  const calCodeChallenge = calCodeVerifier ? generateCodeChallenge(calCodeVerifier) : undefined;

  // Store pending auth
  createPendingAuth({
    state: internalState,
    clientId,
    clientRedirectUri: redirectUri,
    clientState,
    clientCodeChallenge: codeChallenge,
    calCodeVerifier,
  });

  // Redirect to Cal.com authorize
  // Cal.com's OAuth2 authorize endpoint is on app.cal.com, not on the API base URL
  const calAppBaseUrl = config.calAppBaseUrl ?? "https://app.cal.com";
  const calAuthUrl = new URL("/auth/oauth2/authorize", calAppBaseUrl);
  calAuthUrl.searchParams.set("client_id", config.calOAuthClientId);
  calAuthUrl.searchParams.set("redirect_uri", `${config.serverUrl}/oauth/callback`);
  calAuthUrl.searchParams.set("state", internalState);
  if (calCodeChallenge) {
    calAuthUrl.searchParams.set("code_challenge", calCodeChallenge);
    calAuthUrl.searchParams.set("code_challenge_method", "S256");
  }
  calAuthUrl.searchParams.set("response_type", "code");

  res.writeHead(302, { Location: calAuthUrl.toString() });
  res.end();
}

// ── OAuth Callback (GET /oauth/callback) ──

export async function handleCallback(
  req: IncomingMessage,
  res: ServerResponse,
  config: OAuthConfig,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    jsonResponse(res, 400, {
      error: "access_denied",
      error_description: url.searchParams.get("error_description") ?? "User denied authorization",
    });
    return;
  }

  if (!code || !state) {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "Missing code or state" });
    return;
  }

  // Look up pending auth
  const pending = getPendingAuth(state);
  if (!pending) {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "Unknown or expired state parameter" });
    return;
  }

  // Exchange code with Cal.com (RFC 6749-compliant token endpoint)
  // Send either client_secret (confidential) or code_verifier (public PKCE), not both.
  // Cal.com's validator uses forbidNonWhitelisted and rejects mixed requests.
  const exchangeUrl = `${config.calApiBaseUrl}/v2/auth/oauth2/token`;
  const exchangeBody: Record<string, string> = {
    client_id: config.calOAuthClientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${config.serverUrl}/oauth/callback`,
  };
  if (config.calOAuthClientSecret) {
    exchangeBody.client_secret = config.calOAuthClientSecret;
  } else if (pending.calCodeVerifier) {
    exchangeBody.code_verifier = pending.calCodeVerifier;
  }
  const exchangeRes = await fetch(exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exchangeBody),
  });

  if (!exchangeRes.ok) {
    const body = await exchangeRes.text();
    console.error(`[oauth] Cal.com token exchange failed (${exchangeRes.status}): ${body}`);
    deletePendingAuth(state);
    jsonResponse(res, 502, { error: "server_error", error_description: "Token exchange with Cal.com failed" });
    return;
  }

  // Cal.com returns RFC 6749-compliant response: { access_token, refresh_token, expires_in, token_type, scope }
  const tokens = (await exchangeRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  const calAccessToken = tokens.access_token;
  const calRefreshToken = tokens.refresh_token;
  const calTokenExpiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);

  // Create auth code for the MCP client
  const authCode = createAuthCode({
    clientId: pending.clientId,
    redirectUri: pending.clientRedirectUri,
    codeChallenge: pending.clientCodeChallenge,
    calAccessToken,
    calRefreshToken,
    calTokenExpiresAt,
  });

  // Clean up pending auth
  deletePendingAuth(state);

  // Redirect back to MCP client
  const clientRedirect = new URL(pending.clientRedirectUri);
  clientRedirect.searchParams.set("code", authCode);
  clientRedirect.searchParams.set("state", pending.clientState);

  res.writeHead(302, { Location: clientRedirect.toString() });
  res.end();
}

// ── Token Exchange (POST /oauth/token) ──

export async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "method_not_allowed" });
    return;
  }

  const raw = await readBody(req);
  const params = new URLSearchParams(raw);

  const grantType = params.get("grant_type");

  if (grantType === "authorization_code") {
    return handleAuthorizationCodeGrant(params, res);
  }
  if (grantType === "refresh_token") {
    return handleRefreshTokenGrant(params, res);
  }

  jsonResponse(res, 400, { error: "unsupported_grant_type" });
}

function handleAuthorizationCodeGrant(params: URLSearchParams, res: ServerResponse): void {
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const codeVerifier = params.get("code_verifier");
  const clientId = params.get("client_id");

  if (!code || !redirectUri || !codeVerifier || !clientId) {
    jsonResponse(res, 400, {
      error: "invalid_request",
      error_description: "Missing required parameters: code, redirect_uri, code_verifier, client_id",
    });
    return;
  }

  // Consume the auth code (single-use)
  const authCode = consumeAuthCode(code);
  if (!authCode) {
    jsonResponse(res, 400, { error: "invalid_grant", error_description: "Invalid, expired, or already-used authorization code" });
    return;
  }

  // Validate client_id and redirect_uri match
  if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
    jsonResponse(res, 400, { error: "invalid_grant", error_description: "client_id or redirect_uri mismatch" });
    return;
  }

  // Verify PKCE
  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge)) {
    jsonResponse(res, 400, { error: "invalid_grant", error_description: "PKCE code_verifier verification failed" });
    return;
  }

  // Issue access token
  const result = createAccessToken({
    clientId: authCode.clientId,
    calAccessToken: authCode.calAccessToken,
    calRefreshToken: authCode.calRefreshToken,
    calTokenExpiresAt: authCode.calTokenExpiresAt,
  });

  jsonResponse(res, 200, {
    access_token: result.accessToken,
    token_type: "bearer",
    expires_in: result.expiresIn,
    refresh_token: result.refreshToken,
  });
}

function handleRefreshTokenGrant(params: URLSearchParams, res: ServerResponse): void {
  const refreshToken = params.get("refresh_token");
  if (!refreshToken) {
    jsonResponse(res, 400, { error: "invalid_request", error_description: "Missing refresh_token" });
    return;
  }

  const result = rotateAccessToken(refreshToken);
  if (!result) {
    jsonResponse(res, 400, { error: "invalid_grant", error_description: "Invalid refresh token" });
    return;
  }

  jsonResponse(res, 200, {
    access_token: result.accessToken,
    token_type: "bearer",
    expires_in: result.expiresIn,
    refresh_token: result.refreshToken,
  });
}

// ── Token Revocation (POST /oauth/revoke) ──

export async function handleRevoke(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "method_not_allowed" });
    return;
  }

  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const token = params.get("token");

  if (token) {
    deleteAccessToken(token);
  }

  // Per RFC 7009, always return 200 even if token not found
  jsonResponse(res, 200, {});
}

// ── Cal.com Token Refresh ──

/**
 * Refresh Cal.com tokens for an access token record.
 * Returns the new Cal.com access/refresh tokens, or undefined on failure.
 */
export async function refreshCalTokens(
  accessTokenValue: string,
  calRefreshToken: string,
  config: OAuthConfig,
): Promise<{ calAccessToken: string; calRefreshToken: string; calTokenExpiresAt: number } | undefined> {
  // Cal.com uses the same RFC 6749-compliant token endpoint for refresh
  const refreshUrl = `${config.calApiBaseUrl}/v2/auth/oauth2/token`;

  const refreshRes = await fetch(refreshUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.calOAuthClientId,
      client_secret: config.calOAuthClientSecret,
      grant_type: "refresh_token",
      refresh_token: calRefreshToken,
    }),
  });

  if (!refreshRes.ok) {
    console.error(`[oauth] Cal.com token refresh failed (${refreshRes.status})`);
    return undefined;
  }

  // Cal.com returns RFC 6749-compliant response
  const data = (await refreshRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  const { updateCalTokens } = await import("../storage/token-store.js");

  const newCalAccessToken = data.access_token;
  const newCalRefreshToken = data.refresh_token;
  const newCalTokenExpiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600);

  // Update the DB
  updateCalTokens(accessTokenValue, newCalAccessToken, newCalRefreshToken, newCalTokenExpiresAt);

  return {
    calAccessToken: newCalAccessToken,
    calRefreshToken: newCalRefreshToken,
    calTokenExpiresAt: newCalTokenExpiresAt,
  };
}

/**
 * Resolve Cal.com auth headers from a Bearer token.
 * Validates the token, auto-refreshes Cal.com tokens if expired.
 * Returns auth headers for Cal.com API, or undefined if the token is invalid.
 */
export async function resolveCalAuthHeaders(
  bearerToken: string,
  config: OAuthConfig,
): Promise<Record<string, string> | undefined> {
  const record = getAccessToken(bearerToken);
  if (!record) return undefined;

  let { calAccessToken } = record;
  const now = Math.floor(Date.now() / 1000);

  // Auto-refresh Cal.com token if expired or about to expire (60s buffer)
  if (now >= record.calTokenExpiresAt - 60) {
    const refreshed = await refreshCalTokens(bearerToken, record.calRefreshToken, config);
    if (!refreshed) return undefined;
    calAccessToken = refreshed.calAccessToken;
  }

  return {
    Authorization: `Bearer ${calAccessToken}`,
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  };
}
