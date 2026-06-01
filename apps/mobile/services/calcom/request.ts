/**
 * Core HTTP request functionality for Cal.com API
 */

import { fetchWithTimeout } from "@/utils/network";
import { getCalApiUrl } from "@/utils/region";
import { safeLogError, safeLogInfo, safeLogWarn } from "@/utils/safeLogger";

import {
  AuthSessionChangedError,
  clearAuth,
  getAuthConfig,
  getAuthFailureCallback,
  getAuthGeneration,
  getAuthHeader,
  getRefreshTokenFunction,
  getTokenRefreshCallback,
  refreshAuthTokensSingleFlight,
} from "./auth";
import { safeParseErrorJson, safeParseJson } from "./utils";

/**
 * Returns the region-aware Cal.com API base URL (e.g. `https://api.cal.eu/v2`
 * when the user selected EU on the login screen).
 */
export function getApiBaseUrl(): string {
  return `${getCalApiUrl()}/v2`;
}

/**
 * Error thrown for non-2xx API responses, carrying the HTTP status so callers
 * can branch on it (e.g. treat a 404 on unregister as "already deleted")
 * without brittle message string matching.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export const REQUEST_TIMEOUT_MS = 30000;

function getRequestAuthDiagnostics({
  endpoint,
  method,
  apiVersion,
  isRetry,
  responseStatus,
  generationAtRequest,
  accessTokenAtRequest,
}: {
  endpoint: string;
  method?: string;
  apiVersion: string;
  isRetry: boolean;
  responseStatus: number;
  generationAtRequest: number;
  accessTokenAtRequest?: string;
}) {
  const authConfig = getAuthConfig();
  const currentGeneration = getAuthGeneration();

  return {
    endpoint,
    method: method || "GET",
    apiVersion,
    isRetry,
    responseStatus,
    generationAtRequest,
    currentGeneration,
    generationChanged: currentGeneration !== generationAtRequest,
    hadAccessTokenAtRequest: Boolean(accessTokenAtRequest),
    hasCurrentAccessToken: Boolean(authConfig.accessToken),
    accessTokenChanged: Boolean(
      authConfig.accessToken && authConfig.accessToken !== accessTokenAtRequest
    ),
    hasRefreshToken: Boolean(authConfig.refreshToken),
    hasRefreshTokenFunction: Boolean(getRefreshTokenFunction()),
    hasTokenRefreshCallback: Boolean(getTokenRefreshCallback()),
    hasAuthFailureCallback: Boolean(getAuthFailureCallback()),
  };
}

/**
 * Test function for bookings API specifically
 */
export async function testRawBookingsAPI(): Promise<void> {
  try {
    const url = `${getApiBaseUrl()}/bookings?status=upcoming&status=unconfirmed&limit=50`;

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
          "cal-api-version": "2024-08-13",
        },
      },
      REQUEST_TIMEOUT_MS
    );

    const responseText = await response.text();

    if (responseText?.trim()) {
      const _responseJson = safeParseJson(responseText);
      if (!_responseJson) {
        safeLogError("[CalComAPIService] Failed to parse bookings response", {
          responseLength: responseText.length,
        });
      }
    }
  } catch (_error) {
    safeLogError("[CalComAPIService] testRawBookingsAPI failed", {
      error: _error,
    });
  }
}

/**
 * Make an authenticated request to the Cal.com API
 */
export async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  apiVersion: string = "2024-08-13",
  isRetry: boolean = false
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  // Capture the access token this request used so that, on a 401, we can tell
  // whether a parallel request already refreshed it (in which case we just
  // retry rather than refresh again or tear down a now-valid session).
  const accessTokenAtRequest = getAuthConfig().accessToken;
  // Capture the auth session generation too. The token string alone can't
  // distinguish "the same session refreshed" from "this session logged out and
  // a new one logged in" — both change the token. If the generation changed,
  // this request belongs to a dead session and must NOT be retried (retrying
  // would replay it, possibly a mutation, under the new user's credentials).
  const generationAtRequest = getAuthGeneration();

  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
        "cal-api-version": apiVersion,
        ...options.headers,
      },
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorBody = await response.text();

    // Parse error for better user messages
    let errorMessage = response.statusText;

    const errorJson = safeParseErrorJson(errorBody);
    if (errorJson) {
      errorMessage = errorJson?.error?.message || errorJson?.message || response.statusText;
    } else {
      // If JSON parsing fails, use the raw error body
      errorMessage = errorBody || response.statusText;
    }

    // Handle specific error cases
    if (response.status === 401) {
      const authConfig = getAuthConfig();
      const diagnostics = getRequestAuthDiagnostics({
        endpoint,
        method: options.method,
        apiVersion,
        isRetry,
        responseStatus: response.status,
        generationAtRequest,
        accessTokenAtRequest,
      });

      safeLogWarn("[CalComAPIService] 401 response", diagnostics);

      // The session was logged out or switched while this request was in flight.
      // Abort instead of retrying — a retry would send this request under the
      // new identity's credentials.
      if (getAuthGeneration() !== generationAtRequest) {
        safeLogWarn(
          "[CalComAPIService] 401 belongs to stale auth generation; aborting",
          diagnostics
        );
        throw new ApiRequestError(response.status, `API Error: ${response.status} ${errorMessage}`);
      }

      // A parallel request already refreshed the access token while this one
      // was in flight (same session) — retry with the new token instead of
      // refreshing again.
      if (!isRetry && authConfig.accessToken && authConfig.accessToken !== accessTokenAtRequest) {
        safeLogInfo(
          "[CalComAPIService] 401 retrying with token refreshed by parallel request",
          diagnostics
        );
        return makeRequest<T>(endpoint, options, apiVersion, true);
      }

      const refreshToken = authConfig.refreshToken;
      const refreshTokenFunction = getRefreshTokenFunction();
      const tokenRefreshCallback = getTokenRefreshCallback();

      if (!isRetry && refreshToken && refreshTokenFunction && tokenRefreshCallback) {
        try {
          safeLogInfo("[CalComAPIService] 401 attempting token refresh", diagnostics);
          // Single-flight: concurrent 401s sharing this refresh token coalesce
          // into one network refresh.
          await refreshAuthTokensSingleFlight(refreshToken);
        } catch (refreshError) {
          // The session was logged out or switched while the refresh was in
          // flight (the refresh threw, or resolved into a different session).
          // Abort WITHOUT logging out — clearing auth here would tear down the
          // new, valid session because this stale request finished late.
          if (
            refreshError instanceof AuthSessionChangedError ||
            getAuthGeneration() !== generationAtRequest
          ) {
            safeLogWarn(
              "[CalComAPIService] token refresh resolved after auth generation changed; aborting",
              diagnostics
            );
            throw new ApiRequestError(
              response.status,
              `API Error: ${response.status} ${errorMessage}`
            );
          }
          // If another request refreshed successfully while ours lost the race
          // within the SAME session, don't log out a now-valid session — retry.
          if (
            getAuthGeneration() === generationAtRequest &&
            getAuthConfig().accessToken &&
            getAuthConfig().accessToken !== accessTokenAtRequest
          ) {
            safeLogInfo(
              "[CalComAPIService] token refresh race resolved by another request; retrying",
              diagnostics
            );
            return makeRequest<T>(endpoint, options, apiVersion, true);
          }
          safeLogError("[CalComAPIService] token refresh failed", {
            diagnostics,
            error: refreshError,
          });
          safeLogWarn("[CalComAPIService] clearing auth after failed token refresh", diagnostics);
          const onAuthFailure = getAuthFailureCallback();
          clearAuth();
          // Trigger full logout so AuthContext resets isAuthenticated
          await onAuthFailure?.();
          throw new Error("Authentication failed. Please sign in again.");
        }
        // The session was logged out or switched across the refresh. Abort
        // WITHOUT logging out — the current session is a new, valid identity
        // and must not be torn down because this stale request finished late.
        // (Checked outside the try so it isn't mistaken for a refresh failure.)
        if (getAuthGeneration() !== generationAtRequest) {
          safeLogWarn(
            "[CalComAPIService] refresh completed after auth generation changed; aborting retry",
            diagnostics
          );
          throw new ApiRequestError(
            response.status,
            `API Error: ${response.status} ${errorMessage}`
          );
        }
        // Retry the original request with the new token.
        safeLogInfo("[CalComAPIService] token refresh succeeded; retrying original request", {
          ...diagnostics,
          currentGeneration: getAuthGeneration(),
        });
        return makeRequest<T>(endpoint, options, apiVersion, true);
      }

      safeLogWarn("[CalComAPIService] 401 has no refresh path; clearing auth", diagnostics);
      const onAuthFailure = getAuthFailureCallback();
      clearAuth();
      await onAuthFailure?.();

      if (errorMessage.includes("expired")) {
        throw new Error("Your authentication has expired. Please sign in again.");
      }
      throw new Error("Authentication failed. Please check your credentials.");
    }

    // Include status code in error message for graceful error handling downstream
    throw new ApiRequestError(response.status, `API Error: ${response.status} ${errorMessage}`);
  }

  return response.json();
}
