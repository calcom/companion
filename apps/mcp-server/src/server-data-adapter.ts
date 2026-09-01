import type { OAuthConfig } from "./auth/oauth-handlers.js";
import { resolveCalAuthHeaders } from "./auth/oauth-handlers.js";
import { isPreviewSmokeMode } from "./preview-smoke-mode.js";
import { endPool, initDb, sql } from "./storage/db.js";
import { cleanupExpired, countRegisteredClients } from "./storage/token-store.js";

export interface ServerDataAdapter {
  mode: "real" | "preview-empty-deny";
  initialize(): Promise<void>;
  checkHealth(): Promise<boolean>;
  cleanupExpired(): Promise<void>;
  countRegisteredClients(): Promise<number>;
  resolveCalAuthHeaders(
    bearerToken: string,
    oauthConfig: OAuthConfig
  ): Promise<Record<string, string> | undefined>;
  close(): Promise<void>;
}

const realDataAdapter: ServerDataAdapter = {
  mode: "real",
  initialize: initDb,
  async checkHealth(): Promise<boolean> {
    try {
      await sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
  cleanupExpired,
  countRegisteredClients,
  resolveCalAuthHeaders,
  close: endPool,
};

const previewDataAdapter: ServerDataAdapter = {
  mode: "preview-empty-deny",
  async initialize(): Promise<void> {},
  async checkHealth(): Promise<boolean> {
    return true;
  },
  async cleanupExpired(): Promise<void> {},
  async countRegisteredClients(): Promise<number> {
    return 0;
  },
  async resolveCalAuthHeaders(): Promise<undefined> {
    return undefined;
  },
  async close(): Promise<void> {},
};

export function createServerDataAdapter(env: NodeJS.ProcessEnv = process.env): ServerDataAdapter {
  return isPreviewSmokeMode(env) ? previewDataAdapter : realDataAdapter;
}
