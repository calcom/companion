import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPendingAuth, consumePendingAuth, cleanupExpiredStates } from "./state-store.js";
import { getDb, closeDb } from "../storage/db.js";
import { sql } from "drizzle-orm";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

beforeEach(() => {
  process.env.CAL_TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  process.env.DATABASE_PATH = ":memory:";
});

afterEach(() => {
  delete process.env.CAL_TOKEN_ENCRYPTION_KEY;
  delete process.env.DATABASE_PATH;
  closeDb();
});

describe("createPendingAuth", () => {
  it("creates a pending auth entry with PKCE values", () => {
    const pending = createPendingAuth("tenant-1", "http://localhost:3100/oauth/callback");

    expect(pending.state).toHaveLength(64);
    expect(pending.tenantId).toBe("tenant-1");
    expect(pending.codeVerifier).toHaveLength(64);
    expect(pending.codeChallenge).toBeTruthy();
    expect(pending.redirectUri).toBe("http://localhost:3100/oauth/callback");
    expect(pending.createdAt).toBeGreaterThan(0);
  });
});

describe("consumePendingAuth", () => {
  it("retrieves and deletes a pending auth entry", () => {
    const pending = createPendingAuth("tenant-1", "http://localhost/callback");

    const consumed = consumePendingAuth(pending.state);
    expect(consumed).toBeDefined();
    expect(consumed?.tenantId).toBe("tenant-1");
    expect(consumed?.codeVerifier).toBe(pending.codeVerifier);

    // Second consumption should return undefined (one-time use)
    const second = consumePendingAuth(pending.state);
    expect(second).toBeUndefined();
  });

  it("returns undefined for non-existent state", () => {
    const result = consumePendingAuth("non-existent-state");
    expect(result).toBeUndefined();
  });

  it("returns undefined for expired state", () => {
    const pending = createPendingAuth("tenant-1", "http://localhost/callback");

    // Manually expire the entry by setting createdAt to the past
    const db = getDb();
    const expiredTime = Date.now() - 11 * 60 * 1000; // 11 minutes ago (> 10 min expiry)
    db.run(
      sql`UPDATE pending_auths SET created_at = ${expiredTime} WHERE state = ${pending.state}`,
    );

    const consumed = consumePendingAuth(pending.state);
    expect(consumed).toBeUndefined();
  });
});

describe("cleanupExpiredStates", () => {
  it("removes expired entries", () => {
    const pending = createPendingAuth("tenant-1", "http://localhost/callback");

    // Manually expire
    const db = getDb();
    const expiredTime = Date.now() - 11 * 60 * 1000;
    db.run(
      sql`UPDATE pending_auths SET created_at = ${expiredTime} WHERE state = ${pending.state}`,
    );

    cleanupExpiredStates();

    // Should be gone
    const consumed = consumePendingAuth(pending.state);
    expect(consumed).toBeUndefined();
  });

  it("does not remove non-expired entries", () => {
    const pending = createPendingAuth("tenant-1", "http://localhost/callback");

    cleanupExpiredStates();

    // Should still be retrievable
    const consumed = consumePendingAuth(pending.state);
    expect(consumed).toBeDefined();
    expect(consumed?.tenantId).toBe("tenant-1");
  });
});
