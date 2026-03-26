import { randomUUID, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getDb } from "./db.js";
import { sql } from "drizzle-orm";

// ── Encryption helpers ──

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CAL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CAL_TOKEN_ENCRYPTION_KEY env var is required for token encryption. Must be 64 hex chars (32 bytes).",
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "CAL_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes for AES-256).",
    );
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const packed = Buffer.from(encoded, "base64");
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(
    IV_LENGTH,
    packed.length - AUTH_TAG_LENGTH,
  );
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

// ── Data model ──

export interface OAuthConnection {
  id: string;
  tenantId: string;
  calUserId: string | null;
  accessToken: string; // decrypted in memory
  refreshToken: string; // decrypted in memory
  expiresAt: number; // unix ms
  scopes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConnectionInput {
  tenantId: string;
  calUserId?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes?: string;
}

export interface UpdateTokensInput {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ── CRUD ──

export function createOAuthConnection(
  input: CreateConnectionInput,
): OAuthConnection {
  const db = getDb();
  const now = Date.now();
  const id = randomUUID();

  db.run(
    sql`INSERT INTO oauth_connections (id, tenant_id, cal_user_id, access_token, refresh_token, expires_at, scopes, created_at, updated_at)
        VALUES (${id}, ${input.tenantId}, ${input.calUserId ?? null}, ${encrypt(input.accessToken)}, ${encrypt(input.refreshToken)}, ${input.expiresAt}, ${input.scopes ?? null}, ${now}, ${now})`,
  );

  return {
    id,
    tenantId: input.tenantId,
    calUserId: input.calUserId ?? null,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt,
    scopes: input.scopes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getOAuthConnection(
  id: string,
): OAuthConnection | undefined {
  const db = getDb();
  const rows = db
    .all<Record<string, unknown>>(
      sql`SELECT * FROM oauth_connections WHERE id = ${id}`,
    );
  const row = rows[0];
  if (!row) return undefined;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    calUserId: row.cal_user_id as string | null,
    accessToken: decrypt(row.access_token as string),
    refreshToken: decrypt(row.refresh_token as string),
    expiresAt: row.expires_at as number,
    scopes: row.scopes as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function getOAuthConnectionsByTenant(
  tenantId: string,
): OAuthConnection[] {
  const db = getDb();
  const rows = db
    .all<Record<string, unknown>>(
      sql`SELECT * FROM oauth_connections WHERE tenant_id = ${tenantId}`,
    );

  return rows.map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    calUserId: row.cal_user_id as string | null,
    accessToken: decrypt(row.access_token as string),
    refreshToken: decrypt(row.refresh_token as string),
    expiresAt: row.expires_at as number,
    scopes: row.scopes as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }));
}

export function updateOAuthConnectionTokens(
  id: string,
  tokens: UpdateTokensInput,
): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    sql`UPDATE oauth_connections
        SET access_token = ${encrypt(tokens.accessToken)},
            refresh_token = ${encrypt(tokens.refreshToken)},
            expires_at = ${tokens.expiresAt},
            updated_at = ${now}
        WHERE id = ${id}`,
  );
}

export function deleteOAuthConnection(id: string): void {
  const db = getDb();
  db.run(sql`DELETE FROM oauth_connections WHERE id = ${id}`);
}
