import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * In-memory sliding-window rate limiter (token bucket per key).
 *
 * Each key (typically a client IP) gets a bucket with `max` tokens.
 * Tokens refill at a rate of `max / windowMs` per millisecond.
 * A request consumes one token; when the bucket is empty the request is rejected.
 *
 * Configurable via environment variables:
 *   RATE_LIMIT_WINDOW_MS  — window size in ms (default: 60 000 = 1 min)
 *   RATE_LIMIT_MAX        — max requests per window (default: 30)
 *
 * Stale buckets are garbage-collected every `windowMs` to prevent memory leaks.
 */

export interface RateLimiterOptions {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per window. */
  max: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly buckets = new Map<string, Bucket>();
  private gcTimer: ReturnType<typeof setInterval> | undefined;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  /**
   * Start periodic garbage collection of stale buckets.
   * Call once when the HTTP server starts. Safe to call multiple times.
   */
  startGc(): void {
    if (this.gcTimer) return;
    this.gcTimer = setInterval(() => this.gc(), this.windowMs);
    // Allow the process to exit even if the timer is still running
    if (this.gcTimer.unref) this.gcTimer.unref();
  }

  /** Stop periodic garbage collection. */
  stopGc(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
  }

  /**
   * Try to consume one token for the given key.
   * Returns `true` if the request is allowed, `false` if rate-limited.
   */
  consume(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.max, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const refillRate = this.max / this.windowMs; // tokens per ms
    const refill = elapsed * refillRate;
    bucket.tokens = Math.min(this.max, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /** Remove buckets that have been idle for longer than the window. */
  private gc(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }

  /** Number of tracked keys (exposed for testing / health check). */
  get size(): number {
    return this.buckets.size;
  }
}

/**
 * Extract the client IP from the request.
 * Respects `X-Forwarded-For` (first entry) when behind a reverse proxy.
 */
export function getClientIp(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Send a 429 Too Many Requests response.
 */
export function sendRateLimited(res: ServerResponse): void {
  res.writeHead(429, {
    "Content-Type": "application/json",
    "Retry-After": "60",
  });
  res.end(JSON.stringify({ error: "too_many_requests", error_description: "Rate limit exceeded. Try again later." }));
}

/**
 * Create a RateLimiter from environment variables with sensible defaults.
 */
export function createRateLimiterFromEnv(): RateLimiter {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const max = Number(process.env.RATE_LIMIT_MAX) || 30;
  return new RateLimiter({ windowMs, max });
}
