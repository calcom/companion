import { getDb } from "../storage/db.js";
import { sql } from "drizzle-orm";
import { generateState, generateCodeVerifier, generateCodeChallenge } from "./pkce.js";

/** Default state expiry: 10 minutes */
const STATE_EXPIRY_MS = 10 * 60 * 1000;

export interface PendingAuth {
  state: string;
  tenantId: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  createdAt: number;
}

/**
 * Create and persist a new OAuth state entry with PKCE values.
 */
export function createPendingAuth(tenantId: string, redirectUri: string): PendingAuth {
  const db = getDb();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const createdAt = Date.now();

  db.run(
    sql`INSERT INTO pending_auths (state, tenant_id, code_verifier, redirect_uri, created_at)
        VALUES (${state}, ${tenantId}, ${codeVerifier}, ${redirectUri}, ${createdAt})`,
  );

  return { state, tenantId, codeVerifier, codeChallenge, redirectUri, createdAt };
}

/**
 * Retrieve and consume a pending auth entry by state.
 * Returns undefined if not found or expired.
 * Deletes the entry after retrieval (one-time use).
 */
export function consumePendingAuth(state: string): PendingAuth | undefined {
  const db = getDb();
  const rows = db.all<Record<string, unknown>>(
    sql`SELECT * FROM pending_auths WHERE state = ${state}`,
  );
  const row = rows[0];
  if (!row) return undefined;

  // Delete immediately (one-time use)
  db.run(sql`DELETE FROM pending_auths WHERE state = ${state}`);

  const createdAt = row.created_at as number;
  if (Date.now() - createdAt > STATE_EXPIRY_MS) {
    return undefined; // expired
  }

  return {
    state: row.state as string,
    tenantId: row.tenant_id as string,
    codeVerifier: row.code_verifier as string,
    codeChallenge: generateCodeChallenge(row.code_verifier as string),
    redirectUri: row.redirect_uri as string,
    createdAt,
  };
}

/**
 * Clean up expired pending auth entries.
 */
export function cleanupExpiredStates(): void {
  const db = getDb();
  const cutoff = Date.now() - STATE_EXPIRY_MS;
  db.run(sql`DELETE FROM pending_auths WHERE created_at < ${cutoff}`);
}
