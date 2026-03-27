import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request auth context using AsyncLocalStorage.
 *
 * In HTTP/OAuth mode, the HTTP server sets the Cal.com auth headers
 * (resolved from the Bearer token) before delegating to the MCP transport.
 * Tool handlers (via calApi) read from this context automatically.
 *
 * In stdio mode, this is never set and calApi falls back to getApiKeyHeaders().
 */
export const authContext = new AsyncLocalStorage<Record<string, string>>();
