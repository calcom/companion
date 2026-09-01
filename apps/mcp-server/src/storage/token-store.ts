import { randomUUID } from "node:crypto";
import { sql } from "./db.js";
import { encrypt, decrypt } from "./encryption.js";

// ── Registered Clients ──

export interface RegisteredClient {
  clientId: string;
  redirectUris: string[];
  clientName: string | null;
}

export async function createRegisteredClient(
  redirectUris: string[],
  clientName?: string
): Promise<RegisteredClient> {
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

export async function createPendingAuth(
  params: Omit<PendingAuth, "expiresAt"> & { ttlSeconds?: number }
): Promise<void> {
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
  calTokenVersion: number;
  calTokenInvalidAt: number | undefined;
  refreshLeaseId: string | undefined;
  refreshLeaseUntil: number | undefined;
  expiresAt: number;
}

export interface CalTokenUpdate {
  calAccessToken: string;
  calRefreshToken: string;
  calTokenExpiresAt: number;
}

export type CalTokenRefreshClaim =
  | { status: "claimed"; leaseId: string; record: AccessTokenRecord }
  | { status: "ready"; record: AccessTokenRecord }
  | { status: "waiting"; leaseUntil: number }
  | { status: "invalid" };

function accessTokenRecordFromRow(row: Record<string, unknown>): AccessTokenRecord {
  return {
    token: row.token as string,
    refreshToken: row.refreshToken as string,
    clientId: row.clientId as string,
    calAccessToken: decrypt(row.calAccessTokenEnc as string),
    calRefreshToken: decrypt(row.calRefreshTokenEnc as string),
    calTokenExpiresAt: row.calTokenExpiresAt as number,
    calTokenVersion: (row.calTokenVersion as number | undefined) ?? 0,
    calTokenInvalidAt: (row.calTokenInvalidAt as number | null | undefined) ?? undefined,
    refreshLeaseId: (row.refreshLeaseId as string | null | undefined) ?? undefined,
    refreshLeaseUntil: (row.refreshLeaseUntil as number | null | undefined) ?? undefined,
    expiresAt: row.expiresAt as number,
  };
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
  return accessTokenRecordFromRow(rows[0]);
}

export async function getAccessTokenByRefresh(
  refreshToken: string
): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    SELECT * FROM "AccessToken"
    WHERE "refreshToken" = ${refreshToken}
      AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER
  `;
  if (rows.length === 0) return undefined;
  return accessTokenRecordFromRow(rows[0]);
}

/** Atomically claim an expiring Cal.com token for refresh. */
export async function claimCalTokenRefresh(
  token: string,
  leaseSeconds: number
): Promise<CalTokenRefreshClaim> {
  const leaseId = randomUUID();
  const { rows: claimedRows } = await sql`
    UPDATE "AccessToken"
    SET "refreshLeaseId" = ${leaseId},
        "refreshLeaseUntil" = EXTRACT(EPOCH FROM NOW())::INTEGER + ${leaseSeconds}
    WHERE "token" = ${token}
      AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER
      AND "calTokenInvalidAt" IS NULL
      AND "calTokenExpiresAt" <= EXTRACT(EPOCH FROM NOW())::INTEGER + 60
      AND ("refreshLeaseId" IS NULL OR "refreshLeaseUntil" IS NULL OR "refreshLeaseUntil" <= EXTRACT(EPOCH FROM NOW())::INTEGER)
    RETURNING *
  `;
  if (claimedRows.length > 0) {
    return { status: "claimed", leaseId, record: accessTokenRecordFromRow(claimedRows[0]) };
  }

  const record = await getAccessToken(token);
  if (!record || record.calTokenInvalidAt !== undefined) return { status: "invalid" };
  const now = Math.floor(Date.now() / 1000);
  if (record.calTokenExpiresAt > now + 60) return { status: "ready", record };
  return { status: "waiting", leaseUntil: record.refreshLeaseUntil ?? now };
}

/** Persist rotated Cal.com credentials only for the current lease generation. */
export async function persistCalTokenRefresh(
  token: string,
  leaseId: string,
  expectedVersion: number,
  update: CalTokenUpdate
): Promise<AccessTokenRecord | undefined> {
  const { rows } = await sql`
    UPDATE "AccessToken"
    SET "calAccessTokenEnc" = ${encrypt(update.calAccessToken)},
        "calRefreshTokenEnc" = ${encrypt(update.calRefreshToken)},
        "calTokenExpiresAt" = ${update.calTokenExpiresAt},
        "calTokenVersion" = "calTokenVersion" + 1,
        "refreshLeaseId" = NULL,
        "refreshLeaseUntil" = NULL
    WHERE "token" = ${token}
      AND "refreshLeaseId" = ${leaseId}
      AND "calTokenVersion" = ${expectedVersion}
      AND "calTokenInvalidAt" IS NULL
    RETURNING *
  `;
  return rows.length > 0 ? accessTokenRecordFromRow(rows[0]) : undefined;
}

/** Mark an irrecoverable upstream grant invalid, fenced to the active lease. */
export async function invalidateCalTokenRefresh(
  token: string,
  leaseId: string,
  expectedVersion: number
): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE "AccessToken"
    SET "calTokenInvalidAt" = EXTRACT(EPOCH FROM NOW())::INTEGER,
        "calTokenVersion" = "calTokenVersion" + 1,
        "refreshLeaseId" = NULL,
        "refreshLeaseUntil" = NULL
    WHERE "token" = ${token}
      AND "refreshLeaseId" = ${leaseId}
      AND "calTokenVersion" = ${expectedVersion}
      AND "calTokenInvalidAt" IS NULL
  `;
  return rowCount === 1;
}

/** Release a lease after a definite non-rotating upstream failure. */
export async function releaseCalTokenRefresh(
  token: string,
  leaseId: string,
  expectedVersion: number
): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE "AccessToken"
    SET "refreshLeaseId" = NULL, "refreshLeaseUntil" = NULL
    WHERE "token" = ${token}
      AND "refreshLeaseId" = ${leaseId}
      AND "calTokenVersion" = ${expectedVersion}
  `;
  return rowCount === 1;
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
 * Rotate the MCP wrapper tokens in-place. An active Cal.com refresh lease keeps
 * the row identifiers stable until its fenced write finishes or the lease expires.
 */
export async function rotateAccessToken(oldRefreshToken: string): Promise<
  | {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }
  | undefined
> {
  const token = randomUUID();
  const refreshToken = randomUUID();
  const ttl = 3600;
  let deadline = Date.now() + 15_000;
  const maximumDeadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { rows } = await sql`
      UPDATE "AccessToken"
      SET "token" = ${token},
          "refreshToken" = ${refreshToken},
          "expiresAt" = EXTRACT(EPOCH FROM NOW())::INTEGER + ${ttl},
          "refreshLeaseId" = NULL,
          "refreshLeaseUntil" = NULL
      WHERE "refreshToken" = ${oldRefreshToken}
        AND "expiresAt" > EXTRACT(EPOCH FROM NOW())::INTEGER
        AND "calTokenInvalidAt" IS NULL
        AND ("refreshLeaseId" IS NULL OR "refreshLeaseUntil" IS NULL OR "refreshLeaseUntil" <= EXTRACT(EPOCH FROM NOW())::INTEGER)
      RETURNING "token"
    `;
    if (rows.length > 0) return { accessToken: token, refreshToken, expiresIn: ttl };

    const existing = await getAccessTokenByRefresh(oldRefreshToken);
    if (!existing || existing.calTokenInvalidAt !== undefined) return undefined;
    if (existing.refreshLeaseUntil) {
      deadline = Math.min(
        maximumDeadline,
        Math.max(deadline, existing.refreshLeaseUntil * 1000 + 1_000)
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
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
