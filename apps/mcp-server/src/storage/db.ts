import { createPool } from "@vercel/postgres";

export const pool = createPool({
  connectionString: process.env.DATABASE_URL,
});

// Bind so the tagged template keeps its `this` — destructuring `pool.sql`
// loses the binding and @vercel/postgres then reads `connectionString` off
// `undefined` at call time.
export const sql = pool.sql.bind(pool);

let initialized = false;

/**
 * Initialize the Postgres database schema.
 * Creates tables and indexes if they do not already exist. Safe to call
 * multiple times. Identifiers are double-quoted so Postgres preserves case
 * (PascalCase tables, camelCase columns).
 */
export async function initDb(): Promise<void> {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS "RegisteredClient" (
      "clientId" TEXT PRIMARY KEY,
      "redirectUris" TEXT NOT NULL,
      "clientName" TEXT,
      "createdAt" INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "PendingAuth" (
      "state" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "clientRedirectUri" TEXT NOT NULL,
      "clientState" TEXT NOT NULL,
      "clientCodeChallenge" TEXT NOT NULL,
      "calCodeVerifier" TEXT,
      "createdAt" INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      "expiresAt" INTEGER NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "PendingAuth_expiresAt_idx" ON "PendingAuth" ("expiresAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "AuthCode" (
      "code" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "redirectUri" TEXT NOT NULL,
      "codeChallenge" TEXT NOT NULL,
      "calAccessTokenEnc" TEXT NOT NULL,
      "calRefreshTokenEnc" TEXT NOT NULL,
      "calTokenExpiresAt" INTEGER NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      "expiresAt" INTEGER NOT NULL,
      "used" INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "AuthCode_expiresAt_idx" ON "AuthCode" ("expiresAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "AccessToken" (
      "token" TEXT PRIMARY KEY,
      "refreshToken" TEXT NOT NULL UNIQUE,
      "clientId" TEXT NOT NULL,
      "calAccessTokenEnc" TEXT NOT NULL,
      "calRefreshTokenEnc" TEXT NOT NULL,
      "calTokenExpiresAt" INTEGER NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
      "expiresAt" INTEGER NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "AccessToken_expiresAt_idx" ON "AccessToken" ("expiresAt")`;

  initialized = true;
}

/**
 * End the connection pool (for graceful shutdown).
 */
export async function endPool(): Promise<void> {
  await pool.end();
  initialized = false;
}
