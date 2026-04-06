import { getApiKeyHeaders } from "../auth.js";
import { authContext } from "../auth/context.js";
import { CAL_API_VERSION_OVERRIDES } from "../config.js";
import { CalApiError } from "./errors.js";
import { logger } from "./logger.js";

function getBaseUrl(): string {
  return process.env.CAL_API_BASE_URL || "https://api.cal.com";
}

function getFetchTimeoutMs(): number {
  return Number(process.env.FETCH_TIMEOUT_MS) || 30_000;
}

function getRetryConfig(): { maxAttempts: number; baseDelayMs: number } {
  const envAttempts = process.env.RETRY_MAX_ATTEMPTS;
  const envDelay = process.env.RETRY_BASE_DELAY_MS;
  return {
    maxAttempts: envAttempts !== undefined && Number.isFinite(Number(envAttempts)) ? Number(envAttempts) : 2,
    baseDelayMs: envDelay !== undefined && Number.isFinite(Number(envDelay)) ? Number(envDelay) : 500,
  };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | string[] | undefined>;
  apiVersionOverride?: string;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const base = getBaseUrl();
  const url = new URL(`/v2/${path.replace(/^\//, "")}`, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function handleResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as Record<string, unknown>).message)
        : `Cal.com API error (${res.status})`;
    throw new CalApiError(res.status, message, body);
  }

  return body;
}

/**
 * Look up a cal-api-version override for the given path.
 *
 * Overrides are keyed by the first path segment (e.g. "event-types") so that
 * both `event-types` and `event-types/123` resolve to the same version.
 */
function resolveVersionOverride(normalizedPath: string): string | undefined {
  const firstSegment = normalizedPath.split("/")[0];
  return CAL_API_VERSION_OVERRIDES[firstSegment];
}

/**
 * Build request headers with auth + any cal-api-version override.
 * In HTTP/OAuth mode, uses per-session Cal.com tokens from authContext.
 * In stdio mode, falls back to API key from env.
 */
function buildRequestHeaders(
  normalizedPath: string,
  apiVersionOverride: string | undefined,
): Record<string, string> {
  const contextHeaders = authContext.getStore();
  const base = contextHeaders ?? getApiKeyHeaders();

  const versionOverride =
    apiVersionOverride ?? resolveVersionOverride(normalizedPath);
  if (versionOverride) {
    return { ...base, "cal-api-version": versionOverride };
  }
  return { ...base };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof CalApiError) {
    return err.status >= 500;
  }
  // Network errors and abort errors are retryable
  if (err instanceof TypeError || err instanceof DOMException) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function calApi<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, apiVersionOverride } = options;
  const url = buildUrl(path, params);
  const normalizedPath = path.replace(/^\//, "");

  const headers = buildRequestHeaders(normalizedPath, apiVersionOverride);
  const timeoutMs = getFetchTimeoutMs();
  const { maxAttempts, baseDelayMs } = getRetryConfig();

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        logger.warn("Retrying Cal.com API request", { path: normalizedPath, attempt, delay });
        await sleep(delay);
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }

      const res = await fetch(url, fetchOptions);
      return (await handleResponse(res)) as T;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
