import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { encrypt, decrypt } from "./encryption.js";

// ── Registered Clients ──

export interface RegisteredClient {
  clientId: string;
  redirectUris: string[];
  clientName: string | null;
}

export function createRegisteredClient(redirectUris: string[], clientName?: string): RegisteredClient {
  const clientId = randomUUID();
  const db = getDb();
  db.prepare(
    "INSERT INTO registered_clients (client_id, redirect_uris, client_name) VALUES (?, ?, ?)",
  ).run(clientId, JSON.stringify(redirectUris), clientName ?? null);
  return { clientId, redirectUris, clientName: clientName ?? null };
}

export function countRegisteredClients(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM registered_clients").get() as { count: number };
  return row.count;
}

export function getRegisteredClient(clientId: string): RegisteredClient | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT client_id, redirect_uris, client_name FROM registered_clients WHERE client_id = ?")
    .get(clientId) as { client_id: string; redirect_uris: string; client_name: string | null } | undefined;
  if (!row) return undefined;
  return {
    clientId: row.client_id,
    redirectUris: JSON.parse(row.redirect_uris) as string[],
    clientName: row.client_name,
  };
}

// ── Pending Auths ──

export interface PendingAuth {
  state: string;
  clientId: string;
  clientRedirectUri: string;
  clientState: string;
  clientCodeChallenge: string;
  calCodeVerifier: string | undefined;
  expiresAt: number;
}

export function createPendingAuth(params: Omit<PendingAuth, "expiresAt"> & { ttlSeconds?: number }): void {
  const db = getDb();
  const expiresAt = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 600); // 10 min default
  db.prepare(
    `INSERT INTO pending_auths (state, client_id, client_redirect_uri, client_state, client_code_challenge, cal_code_verifier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.state,
    params.clientId,
    params.clientRedirectUri,
    params.clientState,
    params.clientCodeChallenge,
    params.calCodeVerifier,
    expiresAt,
  );
}

export function getPendingAuth(state: string): PendingAuth | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pending_auths WHERE state = ? AND expires_at > unixepoch()")
    .get(state) as {
    state: string;
    client_id: string;
    client_redirect_uri: string;
    client_state: string;
    client_code_challenge: string;
    cal_code_verifier: string | null;
    expires_at: number;
  } | undefined;
  if (!row) return undefined;
  return {
    state: row.state,
    clientId: row.client_id,
    clientRedirectUri: row.client_redirect_uri,
    clientState: row.client_state,
    clientCodeChallenge: row.client_code_challenge,
    calCodeVerifier: row.cal_code_verifier ?? undefined,
    expiresAt: row.expires_at,
  };
}

export function deletePendingAuth(state: string): void {
  const db = getDb();
  db.prepare("DELETE FROM pending_auths WHERE state = ?").run(state);
}

// ── Auth Codes ──

export interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
  expiresAt: number;
  used: boolean;
}

export function createAuthCode(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
}): string {
  const code = randomUUID();
  const db = getDb();
  const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min
  db.prepare(
    `INSERT INTO auth_codes (code, client_id, redirect_uri, code_challenge, cal_access_token_enc, cal_refresh_token_enc, cal_token_expires_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    code,
    params.clientId,
    params.redirectUri,
    params.codeChallenge,
    encrypt(params.calAccessToken),
    encrypt(params.calRefreshToken),
    params.calTokenExpiresAt,
    expiresAt,
  );
  return code;
}

export function consumeAuthCode(code: string): AuthCode | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM auth_codes WHERE code = ? AND expires_at > unixepoch() AND used = 0")
    .get(code) as {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    cal_access_token_enc: string;
    cal_refresh_token_enc: string;
    cal_token_expires_at: number;
    expires_at: number;
  } | undefined;
  if (!row) return undefined;

  db.prepare("UPDATE auth_codes SET used = 1 WHERE code = ?").run(code);

  return {
    code: row.code,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    calAccessToken: decrypt(row.cal_access_token_enc),
    calRefreshToken: decrypt(row.cal_refresh_token_enc),
    calTokenExpiresAt: row.cal_token_expires_at,
    expiresAt: row.expires_at,
    used: true,
  };
}

// ── Access Tokens ──

export interface AccessTokenRecord {
  token: string;
  refreshToken: string;
  clientId: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
  expiresAt: number;
}

export function createAccessToken(params: {
  clientId: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
  ttlSeconds?: number;
}): { accessToken: string; refreshToken: string; expiresIn: number } {
  const token = randomUUID();
  const refreshToken = randomUUID();
  const ttl = params.ttlSeconds ?? 3600; // 1 hour default
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const db = getDb();
  db.prepare(
    `INSERT INTO access_tokens (token, refresh_token, client_id, cal_access_token_enc, cal_refresh_token_enc, cal_token_expires_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    token,
    refreshToken,
    params.clientId,
    encrypt(params.calAccessToken),
    encrypt(params.calRefreshToken),
    params.calTokenExpiresAt,
    expiresAt,
  );
  return { accessToken: token, refreshToken, expiresIn: ttl };
}

export function getAccessToken(token: string): AccessTokenRecord | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM access_tokens WHERE token = ? AND expires_at > unixepoch()")
    .get(token) as {
    token: string;
    refresh_token: string;
    client_id: string;
    cal_access_token_enc: string;
    cal_refresh_token_enc: string;
    cal_token_expires_at: number;
    expires_at: number;
  } | undefined;
  if (!row) return undefined;
  return {
    token: row.token,
    refreshToken: row.refresh_token,
    clientId: row.client_id,
    calAccessToken: decrypt(row.cal_access_token_enc),
    calRefreshToken: decrypt(row.cal_refresh_token_enc),
    calTokenExpiresAt: row.cal_token_expires_at,
    expiresAt: row.expires_at,
  };
}

export function getAccessTokenByRefresh(refreshToken: string): AccessTokenRecord | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM access_tokens WHERE refresh_token = ?")
    .get(refreshToken) as {
    token: string;
    refresh_token: string;
    client_id: string;
    cal_access_token_enc: string;
    cal_refresh_token_enc: string;
    cal_token_expires_at: number;
    expires_at: number;
  } | undefined;
  if (!row) return undefined;
  return {
    token: row.token,
    refreshToken: row.refresh_token,
    clientId: row.client_id,
    calAccessToken: decrypt(row.cal_access_token_enc),
    calRefreshToken: decrypt(row.cal_refresh_token_enc),
    calTokenExpiresAt: row.cal_token_expires_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Update the Cal.com tokens for an existing access token (e.g. after refresh).
 */
export function updateCalTokens(
  token: string,
  calAccessToken: string,
  calRefreshToken: string,
  calTokenExpiresAt: number,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE access_tokens SET cal_access_token_enc = ?, cal_refresh_token_enc = ?, cal_token_expires_at = ?
     WHERE token = ?`,
  ).run(encrypt(calAccessToken), encrypt(calRefreshToken), calTokenExpiresAt, token);
}

/**
 * Delete an access token (revocation).
 */
export function deleteAccessToken(token: string): void {
  const db = getDb();
  db.prepare("DELETE FROM access_tokens WHERE token = ?").run(token);
}

/**
 * Delete an access token by its refresh token (for RFC 7009 revocation).
 */
export function deleteAccessTokenByRefresh(refreshToken: string): void {
  const db = getDb();
  db.prepare("DELETE FROM access_tokens WHERE refresh_token = ?").run(refreshToken);
}

/**
 * Rotate: delete old token, issue new one with same Cal.com creds.
 * Wrapped in a transaction so that if createAccessToken fails, the old token is not lost.
 */
export function rotateAccessToken(oldRefreshToken: string): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | undefined {
  const existing = getAccessTokenByRefresh(oldRefreshToken);
  if (!existing) return undefined;

  const db = getDb();
  const rotate = db.transaction(() => {
    deleteAccessToken(existing.token);
    return createAccessToken({
      clientId: existing.clientId,
      calAccessToken: existing.calAccessToken,
      calRefreshToken: existing.calRefreshToken,
      calTokenExpiresAt: existing.calTokenExpiresAt,
    });
  });

  return rotate();
}

// ── Cleanup ──

/**
 * Remove expired rows from all tables.
 */
export function cleanupExpired(): void {
  const db = getDb();
  db.prepare("DELETE FROM pending_auths WHERE expires_at <= unixepoch()").run();
  db.prepare("DELETE FROM auth_codes WHERE expires_at <= unixepoch()").run();
  db.prepare("DELETE FROM access_tokens WHERE expires_at <= unixepoch()").run();
}
