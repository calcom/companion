import Database from "better-sqlite3";

let db: Database.Database | null = null;

/**
 * Get or initialize the SQLite database for OAuth token storage.
 * Uses WAL mode for better concurrent read performance.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || "mcp-server.db";
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    -- Dynamically registered MCP OAuth clients
    CREATE TABLE IF NOT EXISTS registered_clients (
      client_id TEXT PRIMARY KEY,
      redirect_uris TEXT NOT NULL,
      client_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- In-progress authorization flows (Cal.com redirect pending)
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

    -- Authorization codes issued to MCP clients (after Cal.com callback)
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

    -- Issued MCP server access tokens (mapped to Cal.com credentials)
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
