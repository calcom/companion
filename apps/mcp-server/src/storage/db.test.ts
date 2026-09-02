import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sql = vi.fn(async () => ({ rows: [], rowCount: 0 }));
  const pool = {
    sql,
    connect: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  };
  return { createPool: vi.fn(() => pool), pool, sql };
});

vi.mock("@vercel/postgres", () => ({
  createPool: mocks.createPool,
}));

describe("database pool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not require a connection string when the module is imported", async () => {
    vi.resetModules();

    await import("./db.js");

    expect(mocks.createPool).not.toHaveBeenCalled();
  });

  it("creates the pool lazily on the first query", async () => {
    vi.resetModules();
    const { sql } = await import("./db.js");

    await sql`SELECT 1`;

    expect(mocks.createPool).toHaveBeenCalledOnce();
    expect(mocks.sql).toHaveBeenCalledOnce();
  });
});
