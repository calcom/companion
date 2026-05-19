/**
 * React Query Cache Persister
 *
 * Uses the shared storage adapter from utils/storage.ts for cross-platform support.
 */

import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { CACHE_CONFIG } from "@/config/cache.config";
import { getRegion, regionPreloaded } from "./region";
import { safeLogWarn } from "./safeLogger";
import { generalStorage, secureStorage } from "./storage";

function getStorageKey(): string {
  return `${CACHE_CONFIG.persistence.storageKey}-${getRegion()}`;
}

// Use the shared general storage adapter for cache persistence
const storage = generalStorage;

// Duplicated from AuthContext to avoid a circular import; keep these in sync.
// If a persisted cache is found but the user is logged out, don't rehydrate a
// previous user's data into an unauthenticated session. We check BOTH keys
// because OAuth and web-session logins use different storage shapes:
//   - OAuth login writes `cal_oauth_tokens` AND `cal_auth_type = "oauth"`.
//   - Web-session login writes ONLY `cal_auth_type = "web_session"` — no OAuth
//     tokens. Checking `cal_oauth_tokens` alone would wipe web-session users'
//     persisted cache on every cold start.
// Both keys are cleared atomically by `clearAuth()` in AuthContext, so the
// presence of either reliably indicates the user has not logged out.
const OAUTH_TOKENS_KEY = "cal_oauth_tokens";
const AUTH_TYPE_KEY = "cal_auth_type";

/**
 * Create a React Query persister that works across all platforms
 *
 * This persister:
 * - Saves the query cache to platform-appropriate storage
 * - Restores cache on app launch for instant data display
 * - Handles serialization/deserialization of cache data
 * - Respects cache expiration (maxAge)
 */
export const createQueryPersister = (): Persister => {
  const maxAge = CACHE_CONFIG.persistence.maxAge;

  return {
    /**
     * Persist the client state to storage
     */
    persistClient: async (client: PersistedClient): Promise<void> => {
      const storageKey = getStorageKey();
      try {
        const serialized = JSON.stringify(client);
        await storage.setItem(storageKey, serialized);
      } catch (error) {
        safeLogWarn("[QueryPersister] Failed to persist client:", error);
        // Fail silently - persistence is a nice-to-have, not critical
      }
    },

    /**
     * Restore the client state from storage
     */
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      // Fires before AuthProvider.preloadRegion() resolves; wait for the correct region.
      await regionPreloaded;
      const storageKey = getStorageKey();
      try {
        // Bail early if the user is logged out — never restore another user's
        // cache into an unauthenticated session. Wipe the orphaned cache too
        // so a stale logout (e.g. one where queryClient.clear() succeeded but
        // the throttled disk persist ran later) doesn't survive a cold start.
        let hasAuth = false;
        try {
          const [tokens, authType] = await Promise.all([
            secureStorage.get(OAUTH_TOKENS_KEY),
            secureStorage.get(AUTH_TYPE_KEY),
          ]);
          hasAuth = Boolean(tokens) || Boolean(authType);
        } catch (tokenError) {
          safeLogWarn(
            "[QueryPersister] Failed to read auth state, treating as logged out:",
            tokenError
          );
        }
        if (!hasAuth) {
          await storage.removeItem(storageKey);
          return undefined;
        }

        const serialized = await storage.getItem(storageKey);
        if (!serialized) {
          return undefined;
        }

        const client = JSON.parse(serialized) as PersistedClient;

        // Validate timestamp exists and is a valid number
        if (typeof client.timestamp !== "number" || Number.isNaN(client.timestamp)) {
          safeLogWarn("[QueryPersister] Invalid or missing timestamp, discarding cache");
          await storage.removeItem(storageKey);
          return undefined;
        }

        // Check if the persisted cache has expired
        const persistedAt = client.timestamp;
        const now = Date.now();
        if (now - persistedAt > maxAge) {
          // Cache is too old, discard it
          await storage.removeItem(storageKey);
          return undefined;
        }

        return client;
      } catch (error) {
        safeLogWarn("[QueryPersister] Failed to restore client:", error);
        // If restoration fails, start fresh
        return undefined;
      }
    },

    /**
     * Remove the persisted client state
     */
    removeClient: async (): Promise<void> => {
      const storageKey = getStorageKey();
      try {
        await storage.removeItem(storageKey);
      } catch (error) {
        safeLogWarn("[QueryPersister] Failed to remove client:", error);
      }
    },
  };
};

/**
 * Export the storage adapter for potential direct use
 */
export { storage };

/**
 * Utility to clear all query cache from storage
 * Useful for logout or cache reset scenarios
 */
export const clearQueryCache = async (): Promise<void> => {
  try {
    await storage.removeItem(getStorageKey());
  } catch (error) {
    safeLogWarn("[QueryPersister] Failed to clear cache:", error);
  }
};

/**
 * Get cache metadata (for debugging/status display)
 */
export const getCacheMetadata = async (): Promise<{
  exists: boolean;
  timestamp?: number;
  age?: number;
  isExpired?: boolean;
} | null> => {
  try {
    const serialized = await storage.getItem(getStorageKey());
    if (!serialized) {
      return { exists: false };
    }

    const client = JSON.parse(serialized) as PersistedClient;

    // Validate timestamp exists and is a valid number
    if (typeof client.timestamp !== "number" || Number.isNaN(client.timestamp)) {
      return { exists: true, isExpired: true }; // Treat invalid timestamp as expired
    }

    const now = Date.now();
    const age = now - client.timestamp;

    return {
      exists: true,
      timestamp: client.timestamp,
      age,
      isExpired: age > CACHE_CONFIG.persistence.maxAge,
    };
  } catch (error) {
    safeLogWarn("[QueryPersister] Failed to get cache metadata:", error);
    return null;
  }
};
