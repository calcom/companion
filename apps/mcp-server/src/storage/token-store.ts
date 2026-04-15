import { randomUUID } from "node:crypto";
import { sql, pool } from "./db.js";
import { encrypt, decrypt } from "./encryption.js";

// ── Registered Clients ──

export interface RegisteredClient {
  clientId: string;
  redirectUris: string[];
  clientName: string | null;
}

export async function createRegisteredClient(redirectUris: string[], clientName?: string): Promise<RegisteredClient> {
  const clientId = randomUUID();
  const name = clientName ?? null;
  await sql`
    INSERT INTO registered_clients (client_id, redirect_uris, client_name)
    VALUES (${clientId}, ${JSON.stringify(redirectUris)}, ${name})
  `;
  return { clientId, redirectUris, clientName: name };
}

export async function countRegisteredClients(): Promise<number> {
  const { rows } = await sql`SELECT COUNT(*) as count FROM registered_clients`;
  return Number(rows[0].count);
}

export async function getRegisteredClient(clientId: string): Promise<RegisteredClient | undefined> {
  const { rows } = await sql`
    SELECT client_id, redirect_uris, client_name
    FROM registered_clients
    WHERE client_id = ${clientId}
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
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

export async function createPendingAuth(params: Omit<PendingAuth, "expiresAt"> & { ttlSeconds?: number }): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 600); // 10 min default
  const calCodeVerifier = params.calCodeVerifier ?? null;
  await sql`
    INSERT INTO pending_auths (state, client_id, client_redirect_uri, client_state, client_code_challenge, cal_code_verifier, expires_at)
    VALUES (${params.state}, ${params.clientId}, ${params.clientRedirectUri}, ${params.clientState}, ${params.clientCodeChallenge}, ${calCodeVerifier}, ${expiresAt})
  `;
}

export async function getPendingAuth(state: string): Promise<PendingAuth | undefined> {
  const { rows } = await sql`
    SELECT * FROM pending_auths
    WHERE state = ${state} AND expires_at > EXTRACT(EPOCH FROM NOW())::INTEGER
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
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

export async function deletePendingAuth(state: string): Promise<void> {
  await sql`DELETE FROM pending_auths WHERE state = ${state}`;
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

export async function createAuthCode(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
}): Promise<string> {
  const code = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min
  await sql`
    INSERT INTO auth_codes (code, client_id, redirect_uri, code_challenge, cal_access_token_enc, cal_refresh_token_enc, cal_token_expires_at, expires_at)
    VALUES (${code}, ${params.clientId}, ${params.redirectUri}, ${params.codeChallenge}, ${encrypt(params.calAccessToken)}, ${encrypt(params.calRefreshToken)}, ${params.calTokenExpiresAt}, ${expiresAt})
  `;
  return code;
}

export async function consumeAuthCode(code: string): Promise<AuthCode | undefined> {
  // Atomic single-use consumption: UPDATE...RETURNING ensures only one concurrent
  // caller can successfully consume the code (RFC 6749 §10.5).
  const { rows } = await sql`
    UPDATE auth_codes SET used = 1
    WHERE code = ${code} AND expires_at > EXTRACT(EPOCH FROM NOW())::INTEGER AND used = 0
    RETURNING *
  `;
  if (rows.length === 0) return undefined;

  const row = rows[0];
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

export async function createAccessToken(params: {
  clientId: string;
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
  ttlSeconds?: number;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const token = randomUUID();
  const refreshToken = randomUUID();
  const ttl = params.ttlSeconds ?? 3600; // 1 hour default
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  await sql`
    INSERT INTO access_tokens (token, refresh_token, client_id, cal_access_token_enc, cal_refresh_token_enc, cal_token_expires_at, expires_at)
    VALUES (${token}, ${refreshToken}, ${params.clientId}, ${encrypt(params.calAccessToken)}, ${encrypt(params.calRefreshToken)}, ${params.calTokenExpiresAt}, ${expiresAt})
  `;
  return { accessToken: token, refreshToken, expiresIn: ttl };
}

export async function getAccessToken(token: string): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    SELECT * FROM access_tokens
    WHERE token = ${token} AND expires_at > EXTRACT(EPOCH FROM NOW())::INTEGER
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
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

export async function getAccessTokenByRefresh(refreshToken: string): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    SELECT * FROM access_tokens WHERE refresh_token = ${refreshToken}
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
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
export async function updateCalTokens(
  token: string,
  calAccessToken: string,
  calRefreshToken: string,
  calTokenExpiresAt: number,
): Promise<void> {
  await sql`
    UPDATE access_tokens
    SET cal_access_token_enc = ${encrypt(calAccessToken)},
        cal_refresh_token_enc = ${encrypt(calRefreshToken)},
        cal_token_expires_at = ${calTokenExpiresAt}
    WHERE token = ${token}
  `;
}

/**
 * Delete an access token (revocation).
 */
export async function deleteAccessToken(token: string): Promise<void> {
  await sql`DELETE FROM access_tokens WHERE token = ${token}`;
}

/**
 * Delete an access token by its refresh token (for RFC 7009 revocation).
 */
export async function deleteAccessTokenByRefresh(refreshToken: string): Promise<void> {
  await sql`DELETE FROM access_tokens WHERE refresh_token = ${refreshToken}`;
}

/**
 * Rotate: delete old token, issue new one with same Cal.com creds.
 * Wrapped in a transaction so that if the insert fails, the old token is not lost.
 */
export async function rotateAccessToken(oldRefreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | undefined> {
  const existing = await getAccessTokenByRefresh(oldRefreshToken);
  if (!existing) return undefined;

  const token = randomUUID();
  const refreshToken = randomUUID();
  const ttl = 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  // Dedicated client so BEGIN/DELETE/INSERT/COMMIT share one connection.
  // The `sql` tagged template pulls a fresh pooled connection per call, which
  // would make the transaction a no-op.
  const client = await pool.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`DELETE FROM access_tokens WHERE token = ${existing.token}`;
    await client.sql`
      INSERT INTO access_tokens (token, refresh_token, client_id, cal_access_token_enc, cal_refresh_token_enc, cal_token_expires_at, expires_at)
      VALUES (${token}, ${refreshToken}, ${existing.clientId}, ${encrypt(existing.calAccessToken)}, ${encrypt(existing.calRefreshToken)}, ${existing.calTokenExpiresAt}, ${expiresAt})
    `;
    await client.sql`COMMIT`;
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }

  return { accessToken: token, refreshToken, expiresIn: ttl };
}

// ── Cleanup ──

/**
 * Remove expired rows from all tables.
 */
export async function cleanupExpired(): Promise<void> {
  await sql`DELETE FROM pending_auths WHERE expires_at <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
  await sql`DELETE FROM auth_codes WHERE expires_at <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
  await sql`DELETE FROM access_tokens WHERE expires_at <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
}
