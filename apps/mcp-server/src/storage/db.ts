import { sql, db as pool } from "@vercel/postgres";

export { sql };

let initialized = false;

/**
 * Initialize the Postgres database schema.
 * Creates tables if they do not already exist. Safe to call multiple times.
 */
export async function initDb(): Promise<void> {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS registered_clients (
      client_id TEXT PRIMARY KEY,
      redirect_uris TEXT NOT NULL,
      client_name TEXT,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pending_auths (
      state TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_redirect_uri TEXT NOT NULL,
      client_state TEXT NOT NULL,
      client_code_challenge TEXT NOT NULL,
      cal_code_verifier TEXT,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      expires_at INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      cal_access_token_enc TEXT NOT NULL,
      cal_refresh_token_enc TEXT NOT NULL,
      cal_token_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS access_tokens (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      cal_access_token_enc TEXT NOT NULL,
      cal_refresh_token_enc TEXT NOT NULL,
      cal_token_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      expires_at INTEGER NOT NULL
    )
  `;

  initialized = true;
}

/**
 * End the connection pool (for graceful shutdown).
 */
export async function endPool(): Promise<void> {
  await pool.end();
  initialized = false;
}
