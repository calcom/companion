import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, getClientIp } from "./rate-limiter.js";
import type { IncomingMessage } from "node:http";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({ windowMs: 60_000, max: 3 });
  });

  afterEach(() => {
    limiter.stopGc();
    vi.useRealTimers();
  });

  it("allows requests up to the max", () => {
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
  });

  it("rejects requests over the max", () => {
    limiter.consume("ip1");
    limiter.consume("ip1");
    limiter.consume("ip1");
    expect(limiter.consume("ip1")).toBe(false);
  });

  it("tracks keys independently", () => {
    limiter.consume("ip1");
    limiter.consume("ip1");
    limiter.consume("ip1");
    expect(limiter.consume("ip1")).toBe(false);
    expect(limiter.consume("ip2")).toBe(true);
  });

  it("refills tokens over time", () => {
    limiter.consume("ip1");
    limiter.consume("ip1");
    limiter.consume("ip1");
    expect(limiter.consume("ip1")).toBe(false);

    // Advance time by half the window — should refill ~1.5 tokens
    vi.advanceTimersByTime(30_000);
    expect(limiter.consume("ip1")).toBe(true);
  });

  it("fully refills after a full window", () => {
    limiter.consume("ip1");
    limiter.consume("ip1");
    limiter.consume("ip1");

    vi.advanceTimersByTime(60_000);
    // Should be back to full (3 tokens)
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(false);
  });

  it("does not exceed max tokens after long idle", () => {
    vi.advanceTimersByTime(300_000); // 5 minutes idle
    // First access — should still only have max tokens
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(true);
    expect(limiter.consume("ip1")).toBe(false);
  });

  it("garbage collects stale buckets", () => {
    limiter.startGc();
    limiter.consume("ip1");
    expect(limiter.size).toBe(1);

    // Advance past the window so the bucket is stale, then trigger the GC interval
    vi.advanceTimersByTime(120_001);
    expect(limiter.size).toBe(0);
  });

  it("reports size correctly", () => {
    expect(limiter.size).toBe(0);
    limiter.consume("a");
    limiter.consume("b");
    expect(limiter.size).toBe(2);
  });
});

describe("getClientIp", () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
  });

  it("extracts IP from X-Forwarded-For header when TRUST_PROXY is enabled", () => {
    process.env.TRUST_PROXY = "true";
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("ignores X-Forwarded-For when TRUST_PROXY is not set", () => {
    delete process.env.TRUST_PROXY;
    const req = {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("falls back to socket remoteAddress", () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "10.0.0.1" },
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns unknown when no IP available", () => {
    const req = {
      headers: {},
      socket: {},
    } as unknown as IncomingMessage;
    expect(getClientIp(req)).toBe("unknown");
  });
});
