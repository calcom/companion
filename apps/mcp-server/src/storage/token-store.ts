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
    INSERT INTO "RegisteredClient" ("clientId", "redirectUris", "clientName")
    VALUES (${clientId}, ${JSON.stringify(redirectUris)}, ${name})
  `;
  return { clientId, redirectUris, clientName: name };
}

export async function countRegisteredClients(): Promise<number> {
  const { rows } = await sql`SELECT COUNT(*) as count FROM "RegisteredClient"`;
  return Number(rows[0].count);
}

export async function getRegisteredClient(clientId: string): Promise<RegisteredClient | undefined> {
  const { rows } = await sql`
    SELECT "clientId", "redirectUris", "clientName"
    FROM "RegisteredClient"
    WHERE "clientId" = ${clientId}
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    clientId: row.clientId,
    redirectUris: JSON.parse(row.redirectUris) as string[],
    clientName: row.clientName,
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
    INSERT INTO "PendingAuth" ("state", "clientId", "clientRedirectUri", "clientState", "clientCodeChallenge", "calCodeVerifier", "expiresAt")
    VALUES (${params.state}, ${params.clientId}, ${params.clientRedirectUri}, ${params.clientState}, ${params.clientCodeChallenge}, ${calCodeVerifier}, ${expiresAt})
  `;
}

export async function getPendingAuth(state: string): Promise<PendingAuth | undefined> {
  const { rows } = await sql`
    SELECT * FROM "PendingAuth"
    WHERE "state" = ${state} AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    state: row.state,
    clientId: row.clientId,
    clientRedirectUri: row.clientRedirectUri,
    clientState: row.clientState,
    clientCodeChallenge: row.clientCodeChallenge,
    calCodeVerifier: row.calCodeVerifier ?? undefined,
    expiresAt: row.expiresAt,
  };
}

export async function deletePendingAuth(state: string): Promise<void> {
  await sql`DELETE FROM "PendingAuth" WHERE "state" = ${state}`;
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
    INSERT INTO "AuthCode" ("code", "clientId", "redirectUri", "codeChallenge", "calAccessTokenEnc", "calRefreshTokenEnc", "calTokenExpiresAt", "expiresAt")
    VALUES (${code}, ${params.clientId}, ${params.redirectUri}, ${params.codeChallenge}, ${encrypt(params.calAccessToken)}, ${encrypt(params.calRefreshToken)}, ${params.calTokenExpiresAt}, ${expiresAt})
  `;
  return code;
}

export async function consumeAuthCode(code: string): Promise<AuthCode | undefined> {
  // Atomic single-use consumption: UPDATE...RETURNING ensures only one concurrent
  // caller can successfully consume the code (RFC 6749 §10.5).
  const { rows } = await sql`
    UPDATE "AuthCode" SET "used" = 1
    WHERE "code" = ${code} AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER AND "used" = 0
    RETURNING *
  `;
  if (rows.length === 0) return undefined;

  const row = rows[0];
  return {
    code: row.code,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    codeChallenge: row.codeChallenge,
    calAccessToken: decrypt(row.calAccessTokenEnc),
    calRefreshToken: decrypt(row.calRefreshTokenEnc),
    calTokenExpiresAt: row.calTokenExpiresAt,
    expiresAt: row.expiresAt,
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
    INSERT INTO "AccessToken" ("token", "refreshToken", "clientId", "calAccessTokenEnc", "calRefreshTokenEnc", "calTokenExpiresAt", "expiresAt")
    VALUES (${token}, ${refreshToken}, ${params.clientId}, ${encrypt(params.calAccessToken)}, ${encrypt(params.calRefreshToken)}, ${params.calTokenExpiresAt}, ${expiresAt})
  `;
  return { accessToken: token, refreshToken, expiresIn: ttl };
}

export async function getAccessToken(token: string): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    SELECT * FROM "AccessToken"
    WHERE "token" = ${token} AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    token: row.token,
    refreshToken: row.refreshToken,
    clientId: row.clientId,
    calAccessToken: decrypt(row.calAccessTokenEnc),
    calRefreshToken: decrypt(row.calRefreshTokenEnc),
    calTokenExpiresAt: row.calTokenExpiresAt,
    expiresAt: row.expiresAt,
  };
}

export async function getAccessTokenByRefresh(refreshToken: string): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    SELECT * FROM "AccessToken" WHERE "refreshToken" = ${refreshToken}
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0];
  return {
    token: row.token,
    refreshToken: row.refreshToken,
    clientId: row.clientId,
    calAccessToken: decrypt(row.calAccessTokenEnc),
    calRefreshToken: decrypt(row.calRefreshTokenEnc),
    calTokenExpiresAt: row.calTokenExpiresAt,
    expiresAt: row.expiresAt,
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
    UPDATE "AccessToken"
    SET "calAccessTokenEnc" = ${encrypt(calAccessToken)},
        "calRefreshTokenEnc" = ${encrypt(calRefreshToken)},
        "calTokenExpiresAt" = ${calTokenExpiresAt}
    WHERE "token" = ${token}
  `;
}

/**
 * Delete an access token (revocation).
 */
export async function deleteAccessToken(token: string): Promise<void> {
  await sql`DELETE FROM "AccessToken" WHERE "token" = ${token}`;
}

/**
 * Delete an access token by its refresh token (for RFC 7009 revocation).
 */
export async function deleteAccessTokenByRefresh(refreshToken: string): Promise<void> {
  await sql`DELETE FROM "AccessToken" WHERE "refreshToken" = ${refreshToken}`;
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
    await client.sql`DELETE FROM "AccessToken" WHERE "token" = ${existing.token}`;
    await client.sql`
      INSERT INTO "AccessToken" ("token", "refreshToken", "clientId", "calAccessTokenEnc", "calRefreshTokenEnc", "calTokenExpiresAt", "expiresAt")
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
  await sql`DELETE FROM "PendingAuth" WHERE "expiresAt" <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
  await sql`DELETE FROM "AuthCode" WHERE "expiresAt" <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
  await sql`DELETE FROM "AccessToken" WHERE "expiresAt" <= EXTRACT(EPOCH FROM NOW())::INTEGER`;
}
