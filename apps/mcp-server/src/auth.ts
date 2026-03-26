import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_CACHE_PATH = resolve(__dirname, "..", ".cal-oauth-tokens.json");

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let cachedTokens: OAuthTokens | null = null;

function getBaseUrl(): string {
  return process.env.CAL_API_BASE_URL || "https://api.cal.com";
}

function loadTokensFromCache(): OAuthTokens | null {
  try {
    const data = readFileSync(TOKEN_CACHE_PATH, "utf-8");
    return JSON.parse(data) as OAuthTokens;
  } catch {
    return null;
  }
}

function saveTokensToCache(tokens: OAuthTokens): void {
  try {
    mkdirSync(dirname(TOKEN_CACHE_PATH), { recursive: true });
    writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    console.error("[auth] Failed to persist tokens to cache:", err);
  }
}

export type AuthMode = "apikey" | "oauth" | "hosted";

export function getAuthMode(): AuthMode {
  const mode = process.env.CAL_AUTH_MODE || "apikey";
  if (mode !== "apikey" && mode !== "oauth" && mode !== "hosted") {
    throw new Error(`Invalid CAL_AUTH_MODE: ${mode}. Must be "apikey", "oauth", or "hosted".`);
  }
  return mode;
}

export function getApiKeyHeaders(): Record<string, string> {
  const apiKey = process.env.CAL_API_KEY;
  if (!apiKey) {
    throw new Error("CAL_API_KEY is required when CAL_AUTH_MODE=apikey");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  };
}

export function initOAuthTokens(): void {
  const fromCache = loadTokensFromCache();
  if (fromCache) {
    cachedTokens = fromCache;
    return;
  }

  const accessToken = process.env.CAL_OAUTH_ACCESS_TOKEN;
  const refreshToken = process.env.CAL_OAUTH_REFRESH_TOKEN;
  if (accessToken && refreshToken) {
    cachedTokens = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    saveTokensToCache(cachedTokens);
  }
}

export function getOAuthHeaders(): Record<string, string> {
  if (!cachedTokens) {
    throw new Error(
      "OAuth tokens not available. Provide CAL_OAUTH_ACCESS_TOKEN/CAL_OAUTH_REFRESH_TOKEN or run OAuth flow first."
    );
  }
  return {
    Authorization: `Bearer ${cachedTokens.accessToken}`,
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  };
}

export function isTokenExpired(): boolean {
  if (!cachedTokens) return true;
  return Date.now() >= cachedTokens.expiresAt;
}

export async function refreshOAuthToken(): Promise<void> {
  const clientId = process.env.CAL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.CAL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET are required for OAuth refresh."
    );
  }
  if (!cachedTokens) {
    throw new Error("No refresh token available.");
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/v2/oauth/${clientId}/refresh`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: cachedTokens.refreshToken,
      clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  cachedTokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  saveTokensToCache(cachedTokens);
  console.error("[auth] OAuth tokens refreshed successfully.");
}

// ── Per-connection auth (hosted mode) ──

/**
 * Get auth headers for a specific connection (hosted/multi-tenant mode).
 * Automatically refreshes if the connection's token is expired.
 */
export async function getConnectionAuthHeaders(
  connectionId: string,
): Promise<Record<string, string>> {
  const { getOAuthConnection } = await import(
    "./storage/oauth-connections-repo.js"
  );

  const conn = getOAuthConnection(connectionId);
  if (!conn) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  // Auto-refresh if expired (with 60s buffer)
  if (Date.now() >= conn.expiresAt - 60_000) {
    await refreshConnectionTokens(connectionId);
    const refreshed = getOAuthConnection(connectionId);
    if (!refreshed) {
      throw new Error(`Connection ${connectionId} disappeared after refresh`);
    }
    return {
      Authorization: `Bearer ${refreshed.accessToken}`,
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    };
  }

  return {
    Authorization: `Bearer ${conn.accessToken}`,
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  };
}

/**
 * Refresh tokens for a specific connection and update the database.
 */
export async function refreshConnectionTokens(connectionId: string): Promise<void> {
  const { getOAuthConnection, updateOAuthConnectionTokens } = await import(
    "./storage/oauth-connections-repo.js"
  );

  const conn = getOAuthConnection(connectionId);
  if (!conn) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  const clientId = process.env.CAL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.CAL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET are required for token refresh.");
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/v2/oauth/${clientId}/refresh`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: conn.refreshToken,
      clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Connection token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  };

  updateOAuthConnectionTokens(connectionId, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
  });

  console.error("[auth] Connection tokens refreshed successfully.");
}

/**
 * Get auth headers based on mode. For backward compat (apikey + single-account oauth).
 * Hosted mode should use getConnectionAuthHeaders() instead.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const mode = getAuthMode();
  if (mode === "apikey") {
    return getApiKeyHeaders();
  }

  // Single-account OAuth (legacy/stdio mode)
  if (isTokenExpired()) {
    await refreshOAuthToken();
  }
  return getOAuthHeaders();
}
