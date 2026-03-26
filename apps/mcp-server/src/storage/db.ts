import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";

let db: ReturnType<typeof drizzle> | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH || "mcp-server.db";
}

/**
 * Get or create the database connection (singleton).
 * Creates tables on first access.
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (db) return db;

  const sqlite = new Database(getDbPath());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS oauth_connections (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      cal_user_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scopes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_oauth_connections_tenant
    ON oauth_connections(tenant_id)
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS pending_auths (
      state TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  return db;
}

/**
 * Close the database connection (for graceful shutdown / tests).
 */
export function closeDb(): void {
  db = null;
}
