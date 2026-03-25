import { getAuthHeaders, getAuthMode, refreshOAuthToken } from "../auth.js";
import { CalApiError } from "./errors.js";

function getBaseUrl(): string {
  return process.env.CAL_API_BASE_URL || "https://api.cal.com";
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

/** Per-path API version overrides (some endpoints require a newer version). */
const PATH_VERSION_OVERRIDES: Record<string, string> = {
  slots: "2024-09-04",
};

export async function calApi<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, apiVersionOverride } = options;
  const url = buildUrl(path, params);
  const baseHeaders = await getAuthHeaders();

  // Apply version override: explicit option > path-based map > default
  // Spread into a new object to avoid mutating the original headers.
  const normalizedPath = path.replace(/^\//, "");
  const versionOverride =
    apiVersionOverride ?? PATH_VERSION_OVERRIDES[normalizedPath];
  const headers = versionOverride
    ? { ...(baseHeaders as Record<string, string>), "cal-api-version": versionOverride }
    : baseHeaders;

  const fetchOptions: RequestInit = { method, headers };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  let res = await fetch(url, fetchOptions);

  // On 401 in OAuth mode, refresh token and retry once
  if (res.status === 401 && getAuthMode() === "oauth") {
    console.error("[api-client] Got 401, attempting token refresh...");
    await refreshOAuthToken();
    const refreshedHeaders = await getAuthHeaders();
    const retryOptions: RequestInit = { method, headers: refreshedHeaders };
    if (body !== undefined) {
      retryOptions.body = JSON.stringify(body);
    }
    res = await fetch(url, retryOptions);
  }

  return (await handleResponse(res)) as T;
}
