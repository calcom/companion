import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Structured JSON logger with log levels and request context.
 *
 * Outputs one JSON object per line to stderr (stdout is reserved for MCP stdio transport).
 * Supports per-request context (requestId, sessionId) via AsyncLocalStorage.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

const requestContext = new AsyncLocalStorage<LogContext>();

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Run a callback with request-scoped log context.
 * Any log calls within the callback will include the context fields.
 */
export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function write(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const ctx = requestContext.getStore();
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    msg: message,
  };

  if (ctx) {
    if (ctx.requestId) entry.requestId = ctx.requestId;
    if (ctx.sessionId) entry.sessionId = ctx.sessionId;
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) {
        entry[key] = value;
      }
    }
  }

  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>): void {
    write("debug", message, extra);
  },
  info(message: string, extra?: Record<string, unknown>): void {
    write("info", message, extra);
  },
  warn(message: string, extra?: Record<string, unknown>): void {
    write("warn", message, extra);
  },
  error(message: string, extra?: Record<string, unknown>): void {
    write("error", message, extra);
  },
};
