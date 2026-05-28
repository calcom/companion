/**
 * React Query Cache Persister
 *
 * Uses the shared storage adapter from utils/storage.ts for cross-platform support.
 */

import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { CACHE_CONFIG } from "@/config/cache.config";
import { type CalRegion, getRegion, regionPreloaded } from "./region";
import { safeLogWarn } from "./safeLogger";
import { generalStorage, secureStorage } from "./storage";

/**
 * The persisted cache is wrapped in an owner envelope so a restore can verify
 * the cache belongs to the current identity (region + user) before rehydrating
 * it. This prevents one user's cached data from rendering for another user, or
 * an EU cache from restoring into a US session.
 */
interface CacheOwner {
  region: CalRegion;
  userId: number;
}

interface OwnedCacheEnvelope {
  owner: CacheOwner;
  client: PersistedClient;
}

function isOwnedCacheEnvelope(value: unknown): value is OwnedCacheEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<OwnedCacheEnvelope>;
  const owner = candidate.owner;
  if (typeof owner !== "object" || owner === null) return false;
  if (owner.region !== "us" && owner.region !== "eu") return false;
  if (typeof owner.userId !== "number" || Number.isNaN(owner.userId)) return false;
  return typeof candidate.client === "object" && candidate.client !== null;
}

async function getCurrentUserId(): Promise<number | null> {
  try {
    const raw = await secureStorage.get(AUTH_USER_ID_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

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
// Identity of the cache owner. Written by AuthContext after the user profile
// resolves; absence means we cannot attribute the cache to a user and must not
// persist or restore it. Keep in sync with AuthContext.tsx.
const AUTH_USER_ID_KEY = "cal_auth_user_id";

// Pre-region-suffix key. Removed on every restore so pre-migration cache data
// doesn't accumulate on disk; `removeItem` is a no-op once the key is gone.
const LEGACY_STORAGE_KEY = CACHE_CONFIG.persistence.storageKey;

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
        // Never write ownerless cache: without a user id we can't safely
        // attribute it on restore, so drop any existing cache instead.
        const userId = await getCurrentUserId();
        if (userId == null) {
          await storage.removeItem(storageKey);
          return;
        }
        const envelope: OwnedCacheEnvelope = {
          owner: { region: getRegion(), userId },
          client,
        };
        const serialized = JSON.stringify(envelope);
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
        // Sweep the pre-region-suffix key on every restore so legacy data
        // doesn't survive the migration. No-op once the key is gone.
        if (LEGACY_STORAGE_KEY !== storageKey) {
          try {
            await storage.removeItem(LEGACY_STORAGE_KEY);
          } catch (legacyError) {
            safeLogWarn("[QueryPersister] Failed to clean up legacy cache key:", legacyError);
          }
        }

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

        let parsed: unknown;
        try {
          parsed = JSON.parse(serialized);
        } catch (parseError) {
          safeLogWarn("[QueryPersister] Invalid cache JSON, discarding", parseError);
          await storage.removeItem(storageKey);
          return undefined;
        }

        // Reject legacy ownerless caches (bare PersistedClient) and any other
        // malformed shape — we can't attribute them to the current identity.
        if (!isOwnedCacheEnvelope(parsed)) {
          safeLogWarn("[QueryPersister] Cache is missing owner metadata, discarding");
          await storage.removeItem(storageKey);
          return undefined;
        }

        // Region must match the active session (EU cache must not load into US).
        if (parsed.owner.region !== getRegion()) {
          await storage.removeItem(storageKey);
          return undefined;
        }

        // The cache owner must match the authenticated user.
        const currentUserId = await getCurrentUserId();
        if (currentUserId == null || parsed.owner.userId !== currentUserId) {
          await storage.removeItem(storageKey);
          return undefined;
        }

        const client = parsed.client;

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

    const parsed: unknown = JSON.parse(serialized);

    // Only the owner-envelope shape is valid; legacy/ownerless caches are
    // treated as expired so the status indicator reflects they'll be discarded.
    if (!isOwnedCacheEnvelope(parsed)) {
      return { exists: true, isExpired: true };
    }
    const client = parsed.client;

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
