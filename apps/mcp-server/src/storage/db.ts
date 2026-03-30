import Database from "better-sqlite3";

let db: Database.Database | null = null;

/**
 * Get or initialize the SQLite database for OAuth token storage.
 * Uses WAL mode for better concurrent read performance.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || "mcp-server.db";
  const instance = new Database(dbPath);

  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");

  instance.exec(`
    CREATE TABLE IF NOT EXISTS registered_clients (
      client_id TEXT PRIMARY KEY,
      redirect_uris TEXT NOT NULL,
      client_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pending_auths (
      state TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_redirect_uri TEXT NOT NULL,
      client_state TEXT NOT NULL,
      client_code_challenge TEXT NOT NULL,
      cal_code_verifier TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      cal_access_token_enc TEXT NOT NULL,
      cal_refresh_token_enc TEXT NOT NULL,
      cal_token_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS access_tokens (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      cal_access_token_enc TEXT NOT NULL,
      cal_refresh_token_enc TEXT NOT NULL,
      cal_token_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );
  `);

  db = instance;
  return db;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
