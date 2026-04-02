import { z } from "zod";

/** Default Cal.com API version used across all requests. */
export const CAL_API_VERSION = "2024-08-13";

/** Per-path API version overrides (some endpoints require a newer version). */
export const CAL_API_VERSION_OVERRIDES: Record<string, string> = {
  slots: "2024-09-04",
};

const baseSchema = z.object({
  transport: z.enum(["stdio", "http"]).default("stdio"),
  calApiBaseUrl: z.string().url().default("https://api.cal.com"),
  calAppBaseUrl: z.string().url().default("https://app.cal.com"),
  port: z.coerce.number().int().min(1).max(65535).default(3100),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const stdioSchema = baseSchema.extend({
  transport: z.literal("stdio"),
  calApiKey: z.string().min(1, "CAL_API_KEY is required for stdio mode"),
});

const httpSchema = baseSchema.extend({
  transport: z.literal("http"),
  calOAuthClientId: z.string().min(1, "CAL_OAUTH_CLIENT_ID is required for HTTP mode"),
  calOAuthClientSecret: z.string().min(1, "CAL_OAUTH_CLIENT_SECRET is required for HTTP mode"),
  tokenEncryptionKey: z
    .string()
    .length(64, "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
    .regex(/^[0-9a-fA-F]+$/, "TOKEN_ENCRYPTION_KEY must be valid hex"),
  serverUrl: z.string().url("MCP_SERVER_URL must be a valid URL"),
  databasePath: z.string().default("mcp-server.db"),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60_000),
  rateLimitMax: z.coerce.number().int().positive().default(30),
  maxSessions: z.coerce.number().int().positive().default(10_000),
  sessionIdleTimeoutMs: z.coerce.number().int().positive().default(30 * 60 * 1000),
  maxRegisteredClients: z.coerce.number().int().positive().default(10_000),
  trustProxy: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .default("false"),
  corsOrigin: z.string().optional(),
  fetchTimeoutMs: z.coerce.number().int().positive().default(30_000),
  tokenFetchTimeoutMs: z.coerce.number().int().positive().default(10_000),
  retryMaxAttempts: z.coerce.number().int().min(0).max(5).default(2),
  retryBaseDelayMs: z.coerce.number().int().positive().default(500),
  shutdownTimeoutMs: z.coerce.number().int().positive().default(10_000),
});

export type StdioConfig = z.infer<typeof stdioSchema>;
export type HttpConfig = z.infer<typeof httpSchema>;
export type AppConfig = StdioConfig | HttpConfig;

function readEnv(): Record<string, unknown> {
  return {
    transport: process.env.MCP_TRANSPORT || "stdio",
    calApiBaseUrl: process.env.CAL_API_BASE_URL || undefined,
    calAppBaseUrl: process.env.CAL_APP_BASE_URL || undefined,
    port: process.env.PORT || undefined,
    logLevel: process.env.LOG_LEVEL || undefined,
    calApiKey: process.env.CAL_API_KEY || undefined,
    calOAuthClientId: process.env.CAL_OAUTH_CLIENT_ID || undefined,
    calOAuthClientSecret: process.env.CAL_OAUTH_CLIENT_SECRET || undefined,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || undefined,
    serverUrl: process.env.MCP_SERVER_URL || undefined,
    databasePath: process.env.DATABASE_PATH || undefined,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS || undefined,
    rateLimitMax: process.env.RATE_LIMIT_MAX || undefined,
    maxSessions: process.env.MAX_SESSIONS || undefined,
    sessionIdleTimeoutMs: process.env.SESSION_IDLE_TIMEOUT_MS || undefined,
    maxRegisteredClients: process.env.MAX_REGISTERED_CLIENTS || undefined,
    trustProxy: process.env.TRUST_PROXY || undefined,
    corsOrigin: process.env.CORS_ORIGIN || undefined,
    fetchTimeoutMs: process.env.FETCH_TIMEOUT_MS || undefined,
    tokenFetchTimeoutMs: process.env.TOKEN_FETCH_TIMEOUT_MS || undefined,
    retryMaxAttempts: process.env.RETRY_MAX_ATTEMPTS || undefined,
    retryBaseDelayMs: process.env.RETRY_BASE_DELAY_MS || undefined,
    shutdownTimeoutMs: process.env.SHUTDOWN_TIMEOUT_MS || undefined,
  };
}

/**
 * Load and validate configuration from environment variables.
 * Fails fast with clear error messages if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const raw = readEnv();
  const transport = raw.transport;

  if (transport === "http") {
    const result = httpSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid HTTP mode configuration:\n${issues}`);
    }
    return result.data;
  }

  const result = stdioSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid stdio mode configuration:\n${issues}`);
  }
  return result.data;
}
