import type { ApiVersion } from "./constants";

type AuthHeaders = { Authorization: string; [key: string]: unknown };
type VersionedHeaders = { Authorization: string; "cal-api-version": string; [key: string]: unknown };

// Authorization header is populated by the client interceptor at runtime
export function authHeader(): AuthHeaders {
  return { Authorization: "" };
}

export function apiVersionHeader(version: ApiVersion): VersionedHeaders {
  return { Authorization: "", "cal-api-version": version };
}
