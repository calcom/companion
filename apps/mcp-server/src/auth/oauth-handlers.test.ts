import { describe, it, expect, vi } from "vitest";

// oauth-handlers transitively imports the token store, which creates a Postgres
// pool at import time. Mock it so these pure-function tests need no database.
vi.mock("@vercel/postgres", () => {
  const sql = vi.fn(async () => ({ rows: [], rowCount: 0 }));
  const pool = { sql, connect: vi.fn(), end: vi.fn() };
  return { createPool: () => pool, sql, db: pool };
});

const { isLoopbackHost, validateRedirectUri } = await import("./oauth-handlers.js");
type RedirectUriPolicy = import("./oauth-handlers.js").RedirectUriPolicy;

const OPEN: RedirectUriPolicy = { allowedHosts: [] };
const ALLOWLIST: RedirectUriPolicy = { allowedHosts: ["claude.ai", "chatgpt.com"] };

describe("isLoopbackHost", () => {
  it("recognizes localhost and the 127.0.0.0/8 block", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.0.0.2")).toBe(true);
    expect(isLoopbackHost("127.255.255.255")).toBe(true);
  });

  it("recognizes IPv6 loopback with or without brackets", () => {
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
  });

  it("rejects external and look-alike hosts", () => {
    expect(isLoopbackHost("evil.com")).toBe(false);
    expect(isLoopbackHost("127.0.0.1.evil.com")).toBe(false);
    expect(isLoopbackHost("128.0.0.1")).toBe(false);
  });
});

describe("validateRedirectUri", () => {
  it("allows loopback over http (desktop clients)", () => {
    expect(validateRedirectUri("http://localhost:8765/callback", OPEN).ok).toBe(true);
    expect(validateRedirectUri("http://127.0.0.5:9000/cb", OPEN).ok).toBe(true);
    expect(validateRedirectUri("http://[::1]:9000/cb", OPEN).ok).toBe(true);
  });

  it("rejects cleartext http to non-loopback hosts", () => {
    const res = validateRedirectUri("http://evil.com/callback", OPEN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("https");
  });

  it("rejects non-http(s) schemes", () => {
    expect(validateRedirectUri("ftp://example.com/cb", OPEN).ok).toBe(false);
    expect(validateRedirectUri("javascript:alert(1)", OPEN).ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(validateRedirectUri("not a url", OPEN).ok).toBe(false);
  });

  it("with no allowlist, accepts any https host (open DCR default)", () => {
    expect(validateRedirectUri("https://evil.com/callback", OPEN).ok).toBe(true);
  });

  it("with an allowlist, rejects https hosts not on it", () => {
    const res = validateRedirectUri("https://evil.com/callback", ALLOWLIST);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("not in the allowed list");
  });

  it("with an allowlist, accepts https hosts on it (case-insensitive)", () => {
    expect(validateRedirectUri("https://claude.ai/callback", ALLOWLIST).ok).toBe(true);
    expect(validateRedirectUri("https://Claude.AI/callback", ALLOWLIST).ok).toBe(true);
  });

  it("with an allowlist, still allows loopback regardless", () => {
    expect(validateRedirectUri("http://localhost:8765/callback", ALLOWLIST).ok).toBe(true);
  });
});
