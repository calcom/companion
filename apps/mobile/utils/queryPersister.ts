/**
 * React Query Cache Persister
 *
 * Uses the shared storage adapter from utils/storage.ts for cross-platform support.
 * Cache is scoped by region (US/EU) to prevent data leakage between instances
 * that share numeric user IDs.
 */

import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { CACHE_CONFIG } from "@/config/cache.config";
import { getRegion } from "./region";
import { safeLogWarn } from "./safeLogger";
import { generalStorage } from "./storage";

// Use the shared general storage adapter for cache persistence
const storage = generalStorage;

/**
 * Returns the region-scoped storage key for the query cache.
 * This ensures caches from different regions (US/EU) are completely
 * isolated, preventing data leakage when users with the same numeric
 * ID exist across regions.
 */
function getRegionScopedStorageKey(): string {
  return `${CACHE_CONFIG.persistence.storageKey}-${getRegion()}`;
}

/**
 * Create a React Query persister that works across all platforms
 *
 * This persister:
 * - Saves the query cache to platform-appropriate storage
 * - Restores cache on app launch for instant data display
 * - Handles serialization/deserialization of cache data
 * - Respects cache expiration (maxAge)
 * - Scopes cache by region to prevent cross-region data leakage
 */
export const createQueryPersister = (): Persister => {
  const maxAge = CACHE_CONFIG.persistence.maxAge;

  return {
    /**
     * Persist the client state to storage
     */
    persistClient: async (client: PersistedClient): Promise<void> => {
      try {
        const serialized = JSON.stringify(client);
        await storage.setItem(getRegionScopedStorageKey(), serialized);
      } catch (error) {
        safeLogWarn("[QueryPersister] Failed to persist client:", error);
        // Fail silently - persistence is a nice-to-have, not critical
      }
    },

    /**
     * Restore the client state from storage
     */
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const key = getRegionScopedStorageKey();
        const serialized = await storage.getItem(key);
        if (!serialized) {
          return undefined;
        }

        const client = JSON.parse(serialized) as PersistedClient;

        // Validate timestamp exists and is a valid number
        if (typeof client.timestamp !== "number" || Number.isNaN(client.timestamp)) {
          safeLogWarn("[QueryPersister] Invalid or missing timestamp, discarding cache");
          await storage.removeItem(key);
          return undefined;
        }

        // Check if the persisted cache has expired
        const persistedAt = client.timestamp;
        const now = Date.now();
        if (now - persistedAt > maxAge) {
          // Cache is too old, discard it
          await storage.removeItem(key);
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
      try {
        await storage.removeItem(getRegionScopedStorageKey());
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
 * Useful for logout or cache reset scenarios.
 * Clears both the region-scoped key and the legacy unscoped key.
 */
export const clearQueryCache = async (): Promise<void> => {
  try {
    await storage.removeItem(getRegionScopedStorageKey());
    // Also remove the legacy unscoped key to clean up old caches
    await storage.removeItem(CACHE_CONFIG.persistence.storageKey);
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
    const serialized = await storage.getItem(getRegionScopedStorageKey());
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
