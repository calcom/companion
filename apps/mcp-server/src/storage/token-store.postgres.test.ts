import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = testDatabaseUrl ? describe : describe.skip;

describePostgres("AccessToken refresh leases (real Postgres)", () => {
  let tokenStore: typeof import("./token-store.js");
  let postgres: Pool;
  const clientId = `refresh-lease-test-${randomUUID()}`;
  const schema = `refresh_lease_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);
    const admin = new Pool({ connectionString: testDatabaseUrl });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.end();

    postgres = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${schema}`,
    });
    await postgres.query(`
      CREATE TABLE "AccessToken" (
        "token" TEXT PRIMARY KEY,
        "refreshToken" TEXT NOT NULL UNIQUE,
        "clientId" TEXT NOT NULL,
        "calAccessTokenEnc" TEXT NOT NULL,
        "calRefreshTokenEnc" TEXT NOT NULL,
        "calTokenExpiresAt" INTEGER NOT NULL,
        "createdAt" INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER,
        "expiresAt" INTEGER NOT NULL
      )
    `);
    const migration = await readFile(
      new URL("../../migrations/001_access_token_refresh_lease.sql", import.meta.url),
      "utf8"
    );
    await postgres.query(migration);

    const sql = <Row extends QueryResultRow>(
      strings: TemplateStringsArray,
      ...values: (string | number | boolean | undefined | null)[]
    ) => {
      let text = strings[0] ?? "";
      for (let index = 1; index < strings.length; index++) {
        text += `$${index}${strings[index] ?? ""}`;
      }
      return postgres.query<Row>(text, values);
    };
    vi.doMock("./db.js", () => ({ sql }));
    tokenStore = await import("./token-store.js");
  });

  afterAll(async () => {
    if (!postgres) return;
    await postgres.end();
    const admin = new Pool({ connectionString: testDatabaseUrl });
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    vi.doUnmock("./db.js");
  });

  async function createExpiredToken() {
    return tokenStore.createAccessToken({
      clientId,
      calAccessToken: "old-cal-access",
      calRefreshToken: "old-cal-refresh",
      calTokenExpiresAt: Math.floor(Date.now() / 1000) - 1,
    });
  }

  it("allows only one claim across separate connections and lets a waiter reuse the winner", async () => {
    const created = await createExpiredToken();
    const firstClient = await postgres.connect();
    const secondClient = await postgres.connect();
    try {
      const firstPid = await firstClient.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const secondPid = await secondClient.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      expect(firstPid.rows[0]?.pid).not.toBe(secondPid.rows[0]?.pid);

      const claim = (client: PoolClient, leaseId: string) =>
        client.query(
          `UPDATE "AccessToken"
           SET "refreshLeaseId" = $1,
               "refreshLeaseUntil" = EXTRACT(EPOCH FROM NOW())::INTEGER + 10
           WHERE "token" = $2
             AND "calTokenInvalidAt" IS NULL
             AND "calTokenExpiresAt" <= EXTRACT(EPOCH FROM NOW())::INTEGER + 60
             AND ("refreshLeaseId" IS NULL OR "refreshLeaseUntil" <= EXTRACT(EPOCH FROM NOW())::INTEGER)
           RETURNING "refreshLeaseId", "calTokenVersion"`,
          [leaseId, created.accessToken]
        );
      const [first, second] = await Promise.all([
        claim(firstClient, "lease-from-first-connection"),
        claim(secondClient, "lease-from-second-connection"),
      ]);
      expect(first.rows.length + second.rows.length).toBe(1);

      const winner = (first.rows[0] ?? second.rows[0]) as {
        refreshLeaseId: string;
        calTokenVersion: number;
      };
      const persisted = await tokenStore.persistCalTokenRefresh(
        created.accessToken,
        winner.refreshLeaseId,
        winner.calTokenVersion,
        {
          calAccessToken: "winner-access",
          calRefreshToken: "winner-refresh",
          calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
        }
      );
      expect(persisted?.calAccessToken).toBe("winner-access");

      const waiter = await tokenStore.claimCalTokenRefresh(created.accessToken, 10);
      expect(waiter.status).toBe("ready");
      if (waiter.status === "ready") expect(waiter.record.calRefreshToken).toBe("winner-refresh");
    } finally {
      firstClient.release();
      secondClient.release();
    }
  });

  it("recovers an abandoned claim after its lease expires", async () => {
    const created = await createExpiredToken();
    const abandoned = await tokenStore.claimCalTokenRefresh(created.accessToken, 1);
    expect(abandoned.status).toBe("claimed");

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const recovered = await tokenStore.claimCalTokenRefresh(created.accessToken, 10);

    expect(recovered.status).toBe("claimed");
    if (abandoned.status === "claimed" && recovered.status === "claimed") {
      expect(recovered.leaseId).not.toBe(abandoned.leaseId);
    }
  });

  it("rejects a stale worker after a newer lease persists rotated credentials", async () => {
    const created = await createExpiredToken();
    const stale = await tokenStore.claimCalTokenRefresh(created.accessToken, 1);
    expect(stale.status).toBe("claimed");
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const current = await tokenStore.claimCalTokenRefresh(created.accessToken, 10);
    expect(current.status).toBe("claimed");
    if (stale.status !== "claimed" || current.status !== "claimed") return;

    const currentWrite = await tokenStore.persistCalTokenRefresh(
      created.accessToken,
      current.leaseId,
      current.record.calTokenVersion,
      {
        calAccessToken: "current-access",
        calRefreshToken: "current-refresh",
        calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
    );
    const staleWrite = await tokenStore.persistCalTokenRefresh(
      created.accessToken,
      stale.leaseId,
      stale.record.calTokenVersion,
      {
        calAccessToken: "stale-access",
        calRefreshToken: "stale-refresh",
        calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
    );
    const staleInvalidation = await tokenStore.invalidateCalTokenRefresh(
      created.accessToken,
      stale.leaseId,
      stale.record.calTokenVersion
    );

    expect(currentWrite?.calAccessToken).toBe("current-access");
    expect(staleWrite).toBeUndefined();
    expect(staleInvalidation).toBe(false);
    const stored = await tokenStore.getAccessToken(created.accessToken);
    expect(stored?.calAccessToken).toBe("current-access");
    expect(stored?.calTokenInvalidAt).toBeUndefined();
  });

  it("rotates wrapper tokens in place after an active refresh finishes", async () => {
    const created = await createExpiredToken();
    const claim = await tokenStore.claimCalTokenRefresh(created.accessToken, 10);
    expect(claim.status).toBe("claimed");
    if (claim.status !== "claimed") return;

    const rotation = tokenStore.rotateAccessToken(created.refreshToken);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await tokenStore.persistCalTokenRefresh(
      created.accessToken,
      claim.leaseId,
      claim.record.calTokenVersion,
      {
        calAccessToken: "latest-access",
        calRefreshToken: "latest-refresh",
        calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
    );
    const rotated = await rotation;

    expect(rotated).toBeDefined();
    const record = rotated && (await tokenStore.getAccessToken(rotated.accessToken));
    expect(record?.calRefreshToken).toBe("latest-refresh");
    expect(await tokenStore.getAccessToken(created.accessToken)).toBeUndefined();
  });

  it("makes an in-flight refresh write harmless after revocation", async () => {
    const created = await createExpiredToken();
    const claim = await tokenStore.claimCalTokenRefresh(created.accessToken, 10);
    expect(claim.status).toBe("claimed");
    if (claim.status !== "claimed") return;

    await tokenStore.deleteAccessToken(created.accessToken);
    const staleWrite = await tokenStore.persistCalTokenRefresh(
      created.accessToken,
      claim.leaseId,
      claim.record.calTokenVersion,
      {
        calAccessToken: "revoked-access",
        calRefreshToken: "revoked-refresh",
        calTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
    );

    expect(staleWrite).toBeUndefined();
  });
});
