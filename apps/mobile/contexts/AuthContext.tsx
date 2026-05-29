import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { queryKeys } from "@/config/cache.config";
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
import { safeLogWarn } from "@/utils/safeLogger";
import { generalStorage, secureStorage } from "@/utils/storage";
import { clearWidgetBookings } from "@/utils/widgetStorage";

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

type PreLogoutCallback = () => Promise<void>;

interface AuthContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userInfo: AuthUserInfo | null;
  isWebSession: boolean;
  loginFromWebSession: (userInfo: UserProfile) => Promise<void>;
  loginWithOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  registerPreLogoutCallback: (callback: PreLogoutCallback) => () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "cal_access_token";
const REFRESH_TOKEN_KEY = "cal_refresh_token";
const OAUTH_TOKENS_KEY = "cal_oauth_tokens";
const AUTH_TYPE_KEY = "cal_auth_type";
// Identity marker for the persisted query cache owner envelope. Written after
// the user profile resolves and read by the query persister to reject a cache
// that belongs to a different user. Keep in sync with queryPersister.ts.
const AUTH_USER_ID_KEY = "cal_auth_user_id";

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
  // AuthProvider is mounted inside QueryProvider (see app/_layout.tsx), so
  // useQueryClient() resolves the live client we need to wipe on logout and
  // on cross-user cache rehydration.
  const queryClient = useQueryClient();
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
  const setupAfterLogin = useCallback(
    async (token: string, refreshToken?: string) => {
      // Capture the session generation up front. The profile fetch below is a
      // network round-trip; a logout/account switch during it must not let this
      // (now stale) login write the old identity into state or the cache owner.
      const generationAtStart = CalComAPIService.getAuthGeneration();
      CalComAPIService.setAccessToken(token, refreshToken);
      // Drop any user-profile singleton left over from a previous in-memory
      // session (e.g. an extension iframe that outlived a logout, or a future
      // in-session account switch). getUserProfile() returns the cached
      // singleton without an API call if one exists, so without this clear it
      // could hand us the previous user's profile — the mismatch check
      // downstream would then see two matching ids and silently pass.
      CalComAPIService.clearUserProfile();

      try {
        const profile = await CalComAPIService.getUserProfile();
        // A logout/account switch during the fetch above invalidates this login.
        // Bail before writing the owner marker or identity so we don't resurrect
        // or mislabel the cache under the previous user.
        if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
          return;
        }
        // Store user info for use in the app (e.g., to display "You" in bookings)
        if (profile) {
          // If the persisted cache was rehydrated for a different user (cold
          // start before logout fully ran, or a foreign cache that survived
          // restore), wipe everything before the next fetch lands so no PII
          // from the previous identity flashes onto screen.
          const cachedProfile = queryClient.getQueryData<UserProfile>(
            queryKeys.userProfile.current()
          );
          if (cachedProfile && cachedProfile.id !== profile.id) {
            if (__DEV__) {
              console.debug(
                "[AuthContext] Rehydrated cache belonged to a different user; clearing"
              );
            }
            try {
              queryClient.clear();
            } catch (clearError) {
              console.warn("Failed to clear stale in-memory cache:", clearError);
            }
            try {
              await clearQueryCache();
            } catch (cacheError) {
              console.warn("Failed to clear stale persisted cache:", cacheError);
            }
          }
          // Mark the cache owner so the persister can reject another user's
          // cache on the next cold start. Written before setUserInfo so it is
          // in place by the time queries for this identity start persisting.
          try {
            await CalComAPIService.runAuthTransition(async () => {
              await storage.set(AUTH_USER_ID_KEY, String(profile.id));
            });
          } catch (idError) {
            console.warn("Failed to persist auth user id:", idError);
          }
          // Final re-check before the synchronous state flip: the cache-clear
          // and owner-marker writes above are awaits, and a logout/switch during
          // them must not let this stale login set the previous identity.
          if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
            return;
          }
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
    },
    [queryClient]
  );

  // Plain async fn (no useCallback): identity doesn't need to be stable for
  // memoization, and taking `service` explicitly lets cold-start callers pass
  // a freshly-rebuilt service without waiting for the state update to settle.
  const saveOAuthTokens = async (tokens: OAuthTokens, service: CalComOAuthService | null) => {
    // Write both markers as one atomic section so a concurrent rollback/clear
    // can't observe a half-written pair. No network inside the lock.
    await CalComAPIService.runAuthTransition(async () => {
      await storage.set(OAUTH_TOKENS_KEY, JSON.stringify(tokens));
      await storage.set(AUTH_TYPE_KEY, "oauth");
    });

    if (service) {
      try {
        await service.syncTokensToExtension(tokens);
      } catch (error) {
        console.warn("Failed to sync tokens to extension:", error);
      }
    }
  };

  // Undo a token persist that a refresh completed just as the session changed
  // (logout/account switch). `saveOAuthTokens` is not atomic, so a stale
  // refresh can land its disk write before the post-write epoch re-check. We
  // remove the persisted tokens ONLY when storage still holds exactly the ones
  // this refresh wrote — a newer login may have already written its own tokens,
  // and those must never be clobbered.
  const rollbackPersistedTokensIfMatches = async (
    accessToken: string,
    service: CalComOAuthService | null
  ) => {
    try {
      // The read-and-conditional-remove must be atomic against other marker
      // mutations (e.g. a concurrent web-session login writing "web_session"),
      // so it runs as one auth-transition section. No network inside the lock.
      const didRollback = await CalComAPIService.runAuthTransition(async () => {
        const raw = await storage.get(OAUTH_TOKENS_KEY);
        // No stored oauth tokens means there's nothing of ours to undo — a newer
        // login already replaced/cleared them (e.g. a web-session login that
        // writes only AUTH_TYPE_KEY). Bail so we don't wipe that newer marker.
        if (!raw) {
          return false;
        }
        const stored = JSON.parse(raw) as OAuthTokens;
        if (stored.accessToken !== accessToken) {
          return false;
        }
        await storage.remove(OAUTH_TOKENS_KEY);
        // Only clear the auth-type marker if it still says "oauth". A web-session
        // login that ran before this section may have flipped it to
        // "web_session"; removing it then would erase the newer session's marker.
        const authType = await storage.get(AUTH_TYPE_KEY);
        if (authType === "oauth") {
          await storage.remove(AUTH_TYPE_KEY);
        }
        return true;
      });
      if (didRollback && service) {
        try {
          await service.clearTokensFromExtension();
        } catch (extensionError) {
          console.warn("Failed to clear extension tokens during rollback:", extensionError);
        }
      }
    } catch (error) {
      console.warn("Failed to roll back stale refreshed tokens:", error);
    }
  };

  const clearAuth = useCallback(async () => {
    // Clearing every marker is one atomic section so a concurrent login's
    // marker writes either all precede or all follow it. No network inside.
    await CalComAPIService.runAuthTransition(async () => {
      await storage.removeAll([
        ACCESS_TOKEN_KEY,
        REFRESH_TOKEN_KEY,
        OAUTH_TOKENS_KEY,
        AUTH_TYPE_KEY,
        AUTH_USER_ID_KEY,
      ]);
    });

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

  const preLogoutCallbacksRef = useRef<PreLogoutCallback[]>([]);

  const registerPreLogoutCallback = useCallback((callback: PreLogoutCallback) => {
    preLogoutCallbacksRef.current.push(callback);
    return () => {
      preLogoutCallbacksRef.current = preLogoutCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const logout = useCallback(async () => {
    // Advance the auth generation up front (tokens stay valid for the
    // pre-logout DELETE below) so any refresh/request/push registration that
    // resolves during this potentially slow logout sequence is treated as a
    // dead session and not applied/persisted as active.
    CalComAPIService.invalidateAuthSession();
    // Run pre-logout callbacks while auth tokens are still valid (e.g. push
    // token deregistration needs a valid Bearer token for the API call).
    for (const callback of preLogoutCallbacksRef.current) {
      try {
        await callback();
      } catch (callbackError) {
        console.warn("Pre-logout callback failed:", getErrorMessage(callbackError));
      }
    }
    // Each cleanup step has its own try/catch so a failure in one does not
    // skip the others. resetAuthState() always runs last to put the UI in a
    // known logged-out state even if disk writes failed.
    try {
      await clearAuth();
    } catch (clearAuthError) {
      const message = getErrorMessage(clearAuthError);
      console.warn("Failed to clear auth tokens during logout:", message);
      if (__DEV__) {
        console.debug("[AuthContext] clearAuth failed", {
          message,
          stack: getErrorStack(clearAuthError),
        });
      }
    }
    // Clear user preferences to ensure fresh state for next user
    try {
      await generalStorage.removeItem(USER_PREFERENCES_KEY);
    } catch (prefsError) {
      console.warn("Failed to clear user preferences during logout:", prefsError);
    }
    // Memory first, then disk. PersistQueryClient throttles persists
    // (cache.config.ts: throttleTime = 1000ms); clearing the in-memory cache
    // before the disk wipe prevents an in-flight persist from re-writing the
    // previous user's data right after we erased it.
    //
    // IMPORTANT: both of these must run BEFORE clearRegion(). The persister's
    // storage key is region-suffixed (`cal-companion-query-cache-{region}`),
    // so if we reset the region first the disk wipe would target the
    // default-US key and the user's actual region's cache would survive.
    try {
      queryClient.clear();
    } catch (clearError) {
      console.warn("Failed to clear in-memory query cache during logout:", clearError);
    }
    try {
      await clearQueryCache();
    } catch (cacheError) {
      safeLogWarn("Failed to clear persisted query cache during logout:", cacheError);
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
    // Wipe the home-screen widget so the previous user's meetings don't
    // linger after sign-out (no-op on web).
    try {
      await clearWidgetBookings();
    } catch (widgetError) {
      console.warn("Failed to clear widget bookings during logout:", widgetError);
    }
    resetAuthState();
  }, [clearAuth, resetAuthState, queryClient]);

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
        // Capture the generation around the boot refresh: if the user logs out
        // or starts a new login while this in-flight refresh resolves, applying
        // its result would resurrect the previous stored session.
        const generationAtStart = CalComAPIService.getAuthGeneration();
        try {
          console.log("Access token expired, refreshing...");
          tokens = await service.refreshAccessToken(storedTokens.refreshToken);
          if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
            return;
          }
          await saveOAuthTokens(tokens, service);
          tokensWereRefreshed = true;
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          // Only clear if this boot session is still current — a logout or new
          // login may have advanced the generation while the refresh failed,
          // and clearing would wipe that newer session's auth.
          if (CalComAPIService.getAuthGeneration() === generationAtStart) {
            await clearAuth();
          }
          return;
        }
        if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
          // The write may have landed before this check; undo it (only if it's
          // still ours) so a logged-out/replaced session isn't resurrected.
          await rollbackPersistedTokensIfMatches(tokens.accessToken, service);
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
      // The refresh that produced these tokens validated the generation
      // before invoking this callback, but logout/account switch can still
      // advance it during the awaits below. Re-check before each write so we
      // never persist a dead session's tokens (which boot would resurrect)
      // or repoint in-memory auth at the previous identity. Captured outside the
      // try so the catch can tell a dead-session failure from a live one.
      const generationAtStart = CalComAPIService.getAuthGeneration();
      try {
        const tokens: OAuthTokens = {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken || refreshTokenRef.current || undefined,
          tokenType: "Bearer",
          expiresAt,
        };

        if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
          return;
        }
        await saveOAuthTokens(tokens, activeService);
        if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
          // The write may have landed before this check; undo it (only if it's
          // still ours) so the dead session isn't resurrected, and skip the
          // in-memory writes.
          await rollbackPersistedTokensIfMatches(newAccessToken, activeService);
          return;
        }
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
        // Only tear down auth if this refresh still belongs to the current
        // session. If logout/login advanced the generation while the write was
        // failing, this is a dead session's failure and must not log out the
        // newer one.
        if (CalComAPIService.getAuthGeneration() === generationAtStart) {
          await logoutRef.current();
        }
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
      // Provider is unmounting — this is the only place callbacks should be
      // torn down. Logout/401 recovery must NOT clear them (see clearAuth).
      CalComAPIService.clearAuthCallbacks();
    };
  }, []);

  const loginFromWebSession = async (sessionUserInfo: UserProfile) => {
    try {
      // Start a new auth session generation so any in-flight request/refresh
      // from a previous identity is invalidated and can't apply under this one.
      CalComAPIService.beginAuthGeneration();
      // Clear the previous identity's tokens BEFORE flipping to the new user.
      // getTokensFromWebSession() below may return no token, in which case the
      // prior OAuth bearer would otherwise stay live in CalComAPIService + React
      // state under the new user's UI and cache owner.
      CalComAPIService.clearAuth();
      setAccessToken(null);
      setRefreshToken(null);
      // Capture the generation after the synchronous bumps above. If a logout or
      // another login advances it during the awaits below, this web-session
      // login is stale and must abort before applying its identity/tokens.
      const generationAtStart = CalComAPIService.getAuthGeneration();
      try {
        await clearAuth();
      } catch (clearError) {
        safeLogWarn("Failed to clear prior auth tokens before web login:", clearError);
      }
      // Wipe any prior identity's cache before flipping to authenticated:
      // memory first (so a throttled persist can't re-write it), then disk.
      // Without this, the previous user's in-memory React Query data would be
      // re-persisted under the new owner id we write just below — mislabeling
      // user A's cache as user B's (loginWithOAuth already does this; a
      // web-session login that never reaches setupAfterLogin would otherwise
      // skip it entirely).
      try {
        queryClient.clear();
      } catch (memoryCacheError) {
        safeLogWarn("Failed to clear in-memory query cache before web login:", memoryCacheError);
      }
      try {
        await clearQueryCache();
      } catch (cacheError) {
        safeLogWarn("Failed to clear persisted query cache before web login:", cacheError);
      }
      // A logout/login may have started while we were clearing above. Bail
      // before writing this session's owner marker or flipping auth state, so a
      // stale web login can't apply on top of the newer session.
      if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
        return;
      }
      // Persist the cache-owner marker before flipping to authenticated. A
      // web session may never reach setupAfterLogin (no token, or getUserProfile
      // fails), and the query persister now refuses to write ownerless cache, so
      // without this marker web-session users would lose cache persistence.
      try {
        await CalComAPIService.runAuthTransition(async () => {
          await storage.set(AUTH_USER_ID_KEY, String(sessionUserInfo.id));
        });
      } catch (idError) {
        console.warn("Failed to persist auth user id:", idError);
      }
      // Re-check after the owner-marker write: the synchronous state flip below
      // must not run if a logout/newer login advanced the generation during it.
      if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
        return;
      }
      setUserInfo({
        id: sessionUserInfo.id,
        email: sessionUserInfo.email,
        name: sessionUserInfo.name,
        username: sessionUserInfo.username,
      });
      setIsAuthenticated(true);
      setIsWebSession(true);

      // Try to get tokens from web session
      const tokens = await WebAuthService.getTokensFromWebSession();
      // Re-check after the network await: a concurrent logout/login here must
      // not have this session's tokens or marker applied under it.
      if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
        return;
      }
      // Persist the web-session marker only once we've committed (after the
      // recheck), so an aborted stale login never leaves a "web_session" marker
      // behind. Written even when there's no token so the persister keeps cache.
      await CalComAPIService.runAuthTransition(async () => {
        await storage.set(AUTH_TYPE_KEY, "web_session");
      });
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
    // Build from current region at call time — oauthService state can lag behind a region change.
    let currentService: CalComOAuthService | null;
    try {
      currentService = createCalComOAuthService();
    } catch (serviceError) {
      safeLogWarn(
        "Failed to build OAuth service at login time, falling back to cached instance:",
        serviceError
      );
      currentService = oauthService;
    }
    if (!currentService) {
      throw new Error("OAuth service not available. Please check your configuration.");
    }

    setLoading(true);
    try {
      // Start a new auth session generation so any in-flight request/refresh
      // from a previous identity is invalidated and can't apply under this one.
      CalComAPIService.beginAuthGeneration();
      // Capture the generation for this login. The authorization flow below is a
      // long await (browser redirect + token exchange); a logout or newer login
      // during it must abort this flow before it persists tokens or flips auth.
      const generationAtStart = CalComAPIService.getAuthGeneration();
      // Wipe any prior identity's cache before a new login / account switch:
      // memory first (so a throttled persist can't re-write it), then disk.
      try {
        queryClient.clear();
      } catch (memoryCacheError) {
        safeLogWarn("Failed to clear in-memory query cache before login:", memoryCacheError);
      }
      try {
        await clearQueryCache();
      } catch (cacheError) {
        safeLogWarn("Failed to clear query cache before login:", cacheError);
      }
      // Drop the previous owner marker too. Until setupAfterLogin fetches the
      // new profile and writes the new id, the persister must see no owner and
      // refuse to persist — otherwise new-user queries in that window would be
      // wrapped under the previous user's id.
      try {
        await CalComAPIService.runAuthTransition(async () => {
          await storage.remove(AUTH_USER_ID_KEY);
        });
      } catch (idError) {
        safeLogWarn("Failed to clear previous auth user id before login:", idError);
      }
      const tokens = await currentService.startAuthorizationFlow();
      if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
        setLoading(false);
        return;
      }

      // Save tokens
      await saveOAuthTokens(tokens, currentService);
      if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
        // The write may have landed before this check; undo it if it's still
        // ours so a logged-out/replaced session isn't resurrected.
        await rollbackPersistedTokensIfMatches(tokens.accessToken, currentService);
        setLoading(false);
        return;
      }

      // Update state
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken || null);
      setIsAuthenticated(true);
      setIsWebSession(false);

      // Setup API service and refresh function
      await setupAfterLogin(tokens.accessToken, tokens.refreshToken);
      if (tokens.refreshToken) {
        setupRefreshTokenFunction(currentService);
      }

      // Clear PKCE parameters
      currentService.clearPKCEParams();
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
    registerPreLogoutCallback,
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
