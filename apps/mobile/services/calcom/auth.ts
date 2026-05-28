/**
 * Authentication configuration and functions for Cal.com API
 */

// Authentication configuration
interface AuthConfig {
  accessToken?: string;
  refreshToken?: string;
}

// Global auth state
const authConfig: AuthConfig = {};

// Token refresh callback - will be set by AuthContext
let tokenRefreshCallback:
  | ((accessToken: string, refreshToken?: string, expiresAt?: number) => Promise<void>)
  | null = null;

// Refresh token function - will be set by AuthContext
let refreshTokenFunction:
  | ((
      refreshToken: string
    ) => Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number }>)
  | null = null;

// Auth failure callback - invoked when 401 + refresh failure leaves the app in a zombie session
let authFailureCallback: (() => Promise<void>) | null = null;

type RefreshResult = { accessToken: string; refreshToken?: string; expiresAt?: number };

// Single-flight refresh state: dedupe concurrent refreshes for the same
// refresh token so parallel 401s trigger exactly one network refresh.
let inFlightRefresh: { refreshToken: string; promise: Promise<RefreshResult> } | null = null;

/**
 * Set OAuth access token for authentication
 */
export function setAccessToken(accessToken: string, refreshToken?: string): void {
  authConfig.accessToken = accessToken;
  if (refreshToken) {
    authConfig.refreshToken = refreshToken;
  }
}

/**
 * Set refresh token function for automatic token refresh
 */
export function setRefreshTokenFunction(
  refreshFn: (
    refreshToken: string
  ) => Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number }>
): void {
  refreshTokenFunction = refreshFn;
}

/**
 * Clear authentication token state (access + refresh tokens).
 *
 * Deliberately does NOT clear the callback functions: a 401-driven logout or a
 * normal logout must not erase the mounted AuthProvider's callbacks, otherwise
 * a subsequent login -> 401 could not refresh (the refresh path requires
 * `tokenRefreshCallback`). Use `clearAuthCallbacks()` on provider unmount.
 */
export function clearAuth(): void {
  authConfig.accessToken = undefined;
  authConfig.refreshToken = undefined;
  inFlightRefresh = null;
}

/**
 * Clear the auth callback functions. Only the AuthProvider should call this,
 * and only on unmount — not on logout or 401 recovery.
 */
export function clearAuthCallbacks(): void {
  tokenRefreshCallback = null;
  refreshTokenFunction = null;
  authFailureCallback = null;
  inFlightRefresh = null;
}

/**
 * Refresh the auth tokens, coalescing concurrent callers that share the same
 * refresh token into a single network refresh (single-flight). On success the
 * in-memory auth config is updated and the token-refresh callback is notified
 * so AuthContext can persist the new tokens.
 */
export function refreshAuthTokensSingleFlight(refreshToken: string): Promise<RefreshResult> {
  if (inFlightRefresh && inFlightRefresh.refreshToken === refreshToken) {
    return inFlightRefresh.promise;
  }

  const refreshFn = refreshTokenFunction;
  if (!refreshFn) {
    return Promise.reject(new Error("No refresh token function configured."));
  }
  const onTokensRefreshed = tokenRefreshCallback;

  const promise = (async () => {
    const newTokens = await refreshFn(refreshToken);
    authConfig.accessToken = newTokens.accessToken;
    if (newTokens.refreshToken) {
      authConfig.refreshToken = newTokens.refreshToken;
    }
    // Notify AuthContext to persist the new tokens (including expiresAt for
    // proactive refresh).
    if (onTokensRefreshed) {
      await onTokensRefreshed(newTokens.accessToken, newTokens.refreshToken, newTokens.expiresAt);
    }
    return newTokens;
  })();

  inFlightRefresh = { refreshToken, promise };
  void promise
    .catch(() => undefined)
    .finally(() => {
      if (inFlightRefresh?.promise === promise) {
        inFlightRefresh = null;
      }
    });
  return promise;
}

/**
 * Set token refresh callback for OAuth token refresh
 */
export function setTokenRefreshCallback(
  callback: (accessToken: string, refreshToken?: string, expiresAt?: number) => Promise<void>
): void {
  tokenRefreshCallback = callback;
}

/**
 * Get current authentication header
 */
export function getAuthHeader(): string {
  if (authConfig.accessToken) {
    return `Bearer ${authConfig.accessToken}`;
  } else {
    throw new Error("No authentication configured. Please sign in with OAuth.");
  }
}

/**
 * Get the current auth config (for internal use by request module)
 */
export function getAuthConfig(): AuthConfig {
  return authConfig;
}

/**
 * Get the token refresh callback (for internal use by request module)
 */
export function getTokenRefreshCallback(): typeof tokenRefreshCallback {
  return tokenRefreshCallback;
}

/**
 * Get the refresh token function (for internal use by request module)
 */
export function getRefreshTokenFunction(): typeof refreshTokenFunction {
  return refreshTokenFunction;
}

/**
 * Set auth failure callback - called when a 401 cannot be recovered via refresh,
 * so AuthContext can trigger a full logout instead of leaving a zombie session.
 */
export function setAuthFailureCallback(callback: () => Promise<void>): void {
  authFailureCallback = callback;
}

/**
 * Get the auth failure callback (for internal use by request module)
 */
export function getAuthFailureCallback(): typeof authFailureCallback {
  return authFailureCallback;
}
