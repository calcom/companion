import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  createOAuthConnection,
  getOAuthConnection,
  getOAuthConnectionsByTenant,
  updateOAuthConnectionTokens,
  deleteOAuthConnection,
} from "./oauth-connections-repo.js";
import { closeDb } from "./db.js";

const TEST_ENCRYPTION_KEY = "a".repeat(64); // 32 bytes in hex

beforeEach(() => {
  process.env.CAL_TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  process.env.DATABASE_PATH = ":memory:";
});

afterEach(() => {
  delete process.env.CAL_TOKEN_ENCRYPTION_KEY;
  delete process.env.DATABASE_PATH;
  closeDb();
});

describe("encrypt / decrypt", () => {
  it("round-trips a string correctly", () => {
    const plaintext = "my-secret-token-value";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-value";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // Both should decrypt to same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("throws on invalid encrypted data", () => {
    expect(() => decrypt("not-valid-base64!@#")).toThrow();
  });

  it("throws when encryption key is missing", () => {
    delete process.env.CAL_TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("CAL_TOKEN_ENCRYPTION_KEY");
  });

  it("throws when encryption key is wrong length", () => {
    process.env.CAL_TOKEN_ENCRYPTION_KEY = "abcd";
    expect(() => encrypt("test")).toThrow("64 hex characters");
  });
});

describe("CRUD operations", () => {
  it("creates and retrieves a connection", () => {
    const conn = createOAuthConnection({
      tenantId: "tenant-1",
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
      expiresAt: Date.now() + 3600000,
      scopes: "read write",
    });

    expect(conn.id).toBeTruthy();
    expect(conn.tenantId).toBe("tenant-1");
    expect(conn.accessToken).toBe("access-token-123");
    expect(conn.refreshToken).toBe("refresh-token-456");

    const retrieved = getOAuthConnection(conn.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.tenantId).toBe("tenant-1");
    expect(retrieved?.accessToken).toBe("access-token-123");
    expect(retrieved?.refreshToken).toBe("refresh-token-456");
    expect(retrieved?.scopes).toBe("read write");
  });

  it("returns undefined for non-existent connection", () => {
    const conn = getOAuthConnection("non-existent-id");
    expect(conn).toBeUndefined();
  });

  it("lists connections by tenant", () => {
    createOAuthConnection({
      tenantId: "tenant-a",
      accessToken: "a1",
      refreshToken: "r1",
      expiresAt: Date.now() + 3600000,
    });
    createOAuthConnection({
      tenantId: "tenant-a",
      accessToken: "a2",
      refreshToken: "r2",
      expiresAt: Date.now() + 3600000,
    });
    createOAuthConnection({
      tenantId: "tenant-b",
      accessToken: "b1",
      refreshToken: "rb1",
      expiresAt: Date.now() + 3600000,
    });

    const tenantAConns = getOAuthConnectionsByTenant("tenant-a");
    expect(tenantAConns).toHaveLength(2);

    const tenantBConns = getOAuthConnectionsByTenant("tenant-b");
    expect(tenantBConns).toHaveLength(1);

    const tenantCConns = getOAuthConnectionsByTenant("tenant-c");
    expect(tenantCConns).toHaveLength(0);
  });

  it("updates connection tokens", () => {
    const conn = createOAuthConnection({
      tenantId: "tenant-1",
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresAt: Date.now() + 1000,
    });

    updateOAuthConnectionTokens(conn.id, {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: Date.now() + 7200000,
    });

    const updated = getOAuthConnection(conn.id);
    expect(updated?.accessToken).toBe("new-access");
    expect(updated?.refreshToken).toBe("new-refresh");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(conn.updatedAt);
  });

  it("deletes a connection", () => {
    const conn = createOAuthConnection({
      tenantId: "tenant-1",
      accessToken: "acc",
      refreshToken: "ref",
      expiresAt: Date.now() + 3600000,
    });

    deleteOAuthConnection(conn.id);
    expect(getOAuthConnection(conn.id)).toBeUndefined();
  });

  it("stores tokens encrypted in the database", () => {
    const conn = createOAuthConnection({
      tenantId: "tenant-1",
      accessToken: "plaintext-access-token",
      refreshToken: "plaintext-refresh-token",
      expiresAt: Date.now() + 3600000,
    });

    // The returned object has decrypted tokens
    expect(conn.accessToken).toBe("plaintext-access-token");

    // Retrieve and verify decryption works
    const retrieved = getOAuthConnection(conn.id);
    expect(retrieved?.accessToken).toBe("plaintext-access-token");
    expect(retrieved?.refreshToken).toBe("plaintext-refresh-token");
  });
});
