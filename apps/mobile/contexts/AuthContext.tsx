import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { USER_PREFERENCES_KEY } from "@/hooks/useUserPreferences";
import { CalComAPIService } from "@/services/calcom";
import {
  type CalComOAuthService,
  createCalComOAuthService,
  type OAuthTokens,
} from "@/services/oauthService";
import type { UserProfile } from "@/services/types/users.types";
import { WebAuthService } from "@/services/webAuth";
import { clearQueryCache } from "@/utils/queryPersister";
import { clearRegion, getRegion, preloadRegion, subscribeRegion } from "@/utils/region";
import { generalStorage, secureStorage } from "@/utils/storage";

/**
 * Simplified user info stored in auth context
 * Contains only the essential fields needed for the app
 */
interface AuthUserInfo {
  id: number;
  email: string;
  name: string;
  username: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userInfo: AuthUserInfo | null;
  isWebSession: boolean;
  loginFromWebSession: (userInfo: UserProfile) => Promise<void>;
  loginWithOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "cal_access_token";
const REFRESH_TOKEN_KEY = "cal_refresh_token";
const OAUTH_TOKENS_KEY = "cal_oauth_tokens";
const AUTH_TYPE_KEY = "cal_auth_type";

type AuthType = "oauth" | "web_session";

interface AuthProviderProps {
  children: ReactNode;
}

// Use the shared secure storage adapter
const storage = secureStorage;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const getErrorStack = (error: unknown) => (error instanceof Error ? error.stack : undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  "use no memo";
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<AuthUserInfo | null>(null);
  const [isWebSession, setIsWebSession] = useState(false);
  const [loading, setLoading] = useState(true);
  // Construct synchronously on first render so downstream hooks can rely on a
  // non-null service immediately and mount-time configuration failures are
  // logged right away. The effect below rebuilds only if `preloadRegion()`
  // later reports a different region, so we don't double-init in the common
  // case where the persisted region already matches the in-memory default.
  const [oauthService, setOauthService] = useState<CalComOAuthService | null>(() => {
    try {
      return createCalComOAuthService();
    } catch (error) {
      console.warn("Failed to initialize OAuth service:", error);
      return null;
    }
  });

  // Setup refresh token function for OAuth
  const setupRefreshTokenFunction = useCallback((service: CalComOAuthService) => {
    CalComAPIService.setRefreshTokenFunction(async (refreshToken: string) => {
      const newTokens = await service.refreshAccessToken(refreshToken);
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
      };
    });
  }, []);

  // Common post-login setup: configure API service and fetch user profile
  const setupAfterLogin = useCallback(async (token: string, refreshToken?: string) => {
    CalComAPIService.setAccessToken(token, refreshToken);

    try {
      const profile = await CalComAPIService.getUserProfile();
      // Store user info for use in the app (e.g., to display "You" in bookings)
      if (profile) {
        setUserInfo({
          email: profile.email,
          name: profile.name,
          id: profile.id,
          username: profile.username,
        });
      }
    } catch (profileError) {
      console.error("Failed to fetch user profile:", profileError);
      // Don't fail login if profile fetch fails
    }
  }, []);

  // Plain async fn (no useCallback): identity doesn't need to be stable for
  // memoization, and taking `service` explicitly lets cold-start callers pass
  // a freshly-rebuilt service without waiting for the state update to settle.
  const saveOAuthTokens = async (
    tokens: OAuthTokens,
    service: CalComOAuthService | null = oauthService
  ) => {
    await storage.set(OAUTH_TOKENS_KEY, JSON.stringify(tokens));
    await storage.set(AUTH_TYPE_KEY, "oauth");

    if (service) {
      try {
        await service.syncTokensToExtension(tokens);
      } catch (error) {
        console.warn("Failed to sync tokens to extension:", error);
      }
    }
  };

  const clearAuth = useCallback(async () => {
    await storage.removeAll([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, OAUTH_TOKENS_KEY, AUTH_TYPE_KEY]);

    if (oauthService) {
      try {
        await oauthService.clearTokensFromExtension();
      } catch (error) {
        console.warn("Failed to clear tokens from extension:", error);
      }
    }
  }, [oauthService]);

  // Reset all auth state
  const resetAuthState = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUserInfo(null);
    setIsAuthenticated(false);
    setIsWebSession(false);
    CalComAPIService.clearAuth();
    CalComAPIService.clearUserProfile();
  }, []);

  const logout = useCallback(async () => {
    try {
      await clearAuth();
      // Clear user preferences to ensure fresh state for next user
      try {
        await generalStorage.removeItem(USER_PREFERENCES_KEY);
      } catch (prefsError) {
        console.warn("Failed to clear user preferences during logout:", prefsError);
      }
      // Reset the persisted data region so the next user is prompted via the
      // login-screen picker rather than silently inheriting this session's
      // region (the extension background worker clears `cal_region` on logout
      // too — keep the two surfaces in sync).
      try {
        await clearRegion();
      } catch (regionError) {
        console.warn("Failed to clear data region during logout:", regionError);
      }
      // Clear all cached queries to ensure fresh data on re-login
      try {
        await clearQueryCache();
      } catch (cacheError) {
        console.warn("Failed to clear query cache during logout:", cacheError);
      }
      resetAuthState();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to logout", message);
      if (__DEV__) {
        console.debug("[AuthContext] logout failed", { message, stack: getErrorStack(error) });
      }
    }
  }, [clearAuth, resetAuthState]);

  // Handle OAuth authentication. `service` is passed explicitly so the boot
  // effect can hand in a freshly-rebuilt service on cold-start region
  // mismatch without a re-render round-trip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `saveOAuthTokens` is a plain async fn by design (see comment above its declaration). Listing it here would churn this callback's identity every render and provide no correctness benefit.
  const handleOAuthAuth = useCallback(
    async (service: CalComOAuthService, storedTokens: OAuthTokens) => {
      // Refresh token if expired
      let tokens = storedTokens;
      let tokensWereRefreshed = false;
      if (service.isTokenExpired(storedTokens) && storedTokens.refreshToken) {
        try {
          console.log("Access token expired, refreshing...");
          tokens = await service.refreshAccessToken(storedTokens.refreshToken);
          await saveOAuthTokens(tokens, service);
          tokensWereRefreshed = true;
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          await clearAuth();
          return;
        }
      }

      // Set state
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken || null);
      setIsAuthenticated(true);
      setIsWebSession(false);

      // Setup API service and refresh function
      await setupAfterLogin(tokens.accessToken, tokens.refreshToken);
      if (tokens.refreshToken) {
        setupRefreshTokenFunction(service);
      }

      if (!tokensWereRefreshed) {
        try {
          await service.syncTokensToExtension(tokens);
        } catch (error) {
          console.warn("Failed to sync tokens to extension on init:", error);
        }
      }
    },
    [clearAuth, setupAfterLogin, setupRefreshTokenFunction]
  );

  // Handle web session authentication
  const handleWebSessionAuth = useCallback(() => {
    setIsWebSession(true);
  }, []);

  const checkAuthState = useCallback(
    async (service: CalComOAuthService | null) => {
      try {
        const authType = (await storage.get(AUTH_TYPE_KEY)) as AuthType | null;
        const storedOAuthTokens = await storage.get(OAUTH_TOKENS_KEY);
        const storedTokens = storedOAuthTokens ? JSON.parse(storedOAuthTokens) : null;

        if (authType === "oauth" && storedTokens && service) {
          await handleOAuthAuth(service, storedTokens);
        } else if (authType === "web_session") {
          handleWebSessionAuth();
        }
        setLoading(false);
      } catch (error) {
        const message = getErrorMessage(error);
        console.error("Failed to check auth state", message);
        if (__DEV__) {
          console.debug("[AuthContext] checkAuthState failed", {
            message,
            stack: getErrorStack(error),
          });
        }
        setLoading(false);
      }
    },
    [handleOAuthAuth, handleWebSessionAuth]
  );

  // Stable refs so callbacks wired into the shared CalComAPIService below
  // always hit the latest `logout` / `refreshToken`, even though the boot
  // effect runs only once on mount.
  const logoutRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  // Mount-only by design. Refs (`logoutRef`, `refreshTokenRef`) handle live
  // `logout` / `refreshToken` updates; `subscribeRegion` + the preload branch
  // below rebind `oauthService` and `setupRefreshTokenFunction` when needed.
  // Adding `checkAuthState`, `oauthService`, or `setupRefreshTokenFunction`
  // to the dep list would re-run this boot sequence on every identity change
  // and reintroduce the EU cold-start race this effect was collapsed to fix.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only boot effect; see comment above.
  useEffect(() => {
    let cancelled = false;
    let activeService = oauthService;

    const handleTokenRefresh = async (
      newAccessToken: string,
      newRefreshToken?: string,
      expiresAt?: number
    ) => {
      try {
        const tokens: OAuthTokens = {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken || refreshTokenRef.current || undefined,
          tokenType: "Bearer",
          expiresAt,
        };

        await saveOAuthTokens(tokens, activeService);
        setAccessToken(newAccessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        CalComAPIService.setAccessToken(
          newAccessToken,
          newRefreshToken || refreshTokenRef.current || undefined
        );
      } catch (error) {
        const message = getErrorMessage(error);
        console.error("Failed to handle token refresh", message);
        if (__DEV__) {
          console.debug("[AuthContext] token refresh handler failed", {
            message,
            stack: getErrorStack(error),
          });
        }
        await logoutRef.current();
      }
    };

    CalComAPIService.setTokenRefreshCallback(handleTokenRefresh);
    CalComAPIService.setAuthFailureCallback(() => logoutRef.current());

    (async () => {
      const initialRegion = getRegion();
      const region = await preloadRegion();
      if (cancelled) return;
      if (region !== initialRegion) {
        try {
          const rebuilt = createCalComOAuthService();
          activeService = rebuilt;
          setOauthService(rebuilt);
          if (rebuilt) {
            setupRefreshTokenFunction(rebuilt);
          }
        } catch (error) {
          console.warn("Failed to re-initialize OAuth service after preload:", error);
        }
      }
      if (cancelled) return;
      await checkAuthState(activeService);
    })();

    const unsubscribeRegion = subscribeRegion(() => {
      try {
        const next = createCalComOAuthService();
        activeService = next;
        setOauthService(next);
        if (next) {
          setupRefreshTokenFunction(next);
        }
      } catch (error) {
        console.warn("Failed to re-initialize OAuth service after region change:", error);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeRegion();
      CalComAPIService.setTokenRefreshCallback(() => Promise.resolve());
      CalComAPIService.setAuthFailureCallback(() => Promise.resolve());
    };
  }, []);

  const loginFromWebSession = async (sessionUserInfo: UserProfile) => {
    try {
      setUserInfo({
        id: sessionUserInfo.id,
        email: sessionUserInfo.email,
        name: sessionUserInfo.name,
        username: sessionUserInfo.username,
      });
      setIsAuthenticated(true);
      setIsWebSession(true);
      await storage.set(AUTH_TYPE_KEY, "web_session");

      // Try to get tokens from web session
      const tokens = await WebAuthService.getTokensFromWebSession();
      if (tokens.accessToken) {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken || null);
        await setupAfterLogin(tokens.accessToken, tokens.refreshToken);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to login from web session", message);
      if (__DEV__) {
        console.debug("[AuthContext] loginFromWebSession failed", {
          message,
          stack: getErrorStack(error),
        });
      }
      throw error;
    }
  };

  const loginWithOAuth = async (): Promise<void> => {
    if (!oauthService) {
      throw new Error("OAuth service not available. Please check your configuration.");
    }

    setLoading(true);
    try {
      const tokens = await oauthService.startAuthorizationFlow();

      // Save tokens
      await saveOAuthTokens(tokens);

      // Update state
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken || null);
      setIsAuthenticated(true);
      setIsWebSession(false);

      // Setup API service and refresh function
      await setupAfterLogin(tokens.accessToken, tokens.refreshToken);
      if (tokens.refreshToken) {
        setupRefreshTokenFunction(oauthService);
      }

      // Clear PKCE parameters
      oauthService.clearPKCEParams();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      const message = getErrorMessage(error);
      console.error("OAuth login failed", message);
      if (__DEV__) {
        console.debug("[AuthContext] loginWithOAuth failed", {
          message,
          stack: getErrorStack(error),
        });
      }
      throw error;
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    accessToken,
    refreshToken,
    userInfo,
    isWebSession,
    loginFromWebSession,
    loginWithOAuth,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
