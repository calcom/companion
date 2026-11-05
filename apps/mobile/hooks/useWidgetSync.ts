import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { CACHE_CONFIG, queryKeys } from "@/config/cache.config";
import { useAuth } from "@/contexts/AuthContext";
import { type Booking, CalComAPIService } from "@/services/calcom";
import {
  setupNextCallLiveActivityRefresh,
  syncNextCallLiveActivity,
} from "@/services/nextCallLiveActivity";
import {
  clearWidgetBookings,
  setupWidgetRefreshOnAppStateChange,
  updateWidgetBookings,
} from "@/utils/widgetStorage";

export function useWidgetSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Live Activity timers call back into the latest sync so they re-read the query cache
  // instead of the bookings snapshot they were armed with.
  const resyncRef = useRef<() => Promise<void>>(async () => {});
  const liveActivityOptions = useRef({ resync: () => resyncRef.current() }).current;

  const syncBookingsToWidget = useCallback(async () => {
    if (Platform.OS === "web") {
      return;
    }

    // Try to get cached bookings from any of the common query keys used in the app
    // The app uses different filter combinations, so we check multiple keys
    const possibleFilters = [
      { status: ["upcoming"], limit: 50 },
      { status: ["upcoming"] },
      { status: ["upcoming", "unconfirmed"] },
      {},
    ];

    // Skip lists older than the bookings stale time: on cold start the cache holds the snapshot
    // the persister restored (up to 24 h old), which may still list cancelled calls.
    const freshSince = Date.now() - CACHE_CONFIG.bookings.staleTime;
    let cachedBookings: Booking[] | undefined;
    for (const filters of possibleFilters) {
      const queryKey = queryKeys.bookings.list(filters);
      const cached = queryClient.getQueryData<Booking[]>(queryKey);
      const updatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
      if (cached !== undefined && cached.length > 0 && updatedAt >= freshSince) {
        cachedBookings = cached;
        break;
      }
    }

    if (cachedBookings !== undefined && cachedBookings.length > 0) {
      try {
        // Filter bookings that haven't ended yet (includes ongoing meetings)
        // Sort by start time to show soonest first
        // Note: API may return either start/end or startTime/endTime
        const upcomingBookings = cachedBookings
          .filter((booking) => {
            const endTimeStr = booking.endTime || booking.end;
            if (!endTimeStr) {
              return false;
            }
            const endTime = new Date(endTimeStr);
            return endTime > new Date();
          })
          .sort((a, b) => {
            const aStart = new Date(a.startTime || a.start || "").getTime();
            const bStart = new Date(b.startTime || b.start || "").getTime();
            return aStart - bStart;
          });

        await updateWidgetBookings(upcomingBookings);
        await syncNextCallLiveActivity(upcomingBookings, liveActivityOptions);
      } catch (error) {
        console.warn("Failed to sync cached bookings to widget:", error);
      }
    } else {
      // No cached data found, fetch from API
      try {
        const bookings = await CalComAPIService.getBookings({
          status: ["upcoming"],
          limit: 10,
        });

        // Filter bookings that haven't ended yet (includes ongoing meetings)
        const upcomingBookings = bookings
          .filter((booking) => {
            const endTime = new Date(booking.endTime);
            return endTime > new Date();
          })
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        await updateWidgetBookings(upcomingBookings);
        await syncNextCallLiveActivity(upcomingBookings, liveActivityOptions);
      } catch (error) {
        console.warn("Failed to fetch and sync bookings to widget:", error);
      }
    }
  }, [queryClient, liveActivityOptions]);

  useEffect(() => {
    resyncRef.current = syncBookingsToWidget;
  }, [syncBookingsToWidget]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    // Skip the initial sync (and the API fallback inside syncBookingsToWidget)
    // until auth is verified — otherwise the hook fires on every cold start
    // before tokens are loaded and triggers an unauthenticated /bookings request.
    if (!isAuthenticated) {
      return;
    }

    syncBookingsToWidget();

    const cleanupWidget = setupWidgetRefreshOnAppStateChange(syncBookingsToWidget);
    // Live Activities can only start in the foreground, so re-sync when the app comes back.
    const cleanupLiveActivity = setupNextCallLiveActivityRefresh(syncBookingsToWidget);

    // Re-plan whenever a bookings list lands (refetch, cancel/reschedule invalidation), so a
    // cancelled or moved call does not keep its Live Activity until the next app state change.
    let pendingSync: ReturnType<typeof setTimeout> | null = null;
    const listKeyPrefix = queryKeys.bookings.lists();
    const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const key = event.query.queryKey;
      if (key[0] !== listKeyPrefix[0] || key[1] !== listKeyPrefix[1]) return;
      if (pendingSync !== null) clearTimeout(pendingSync);
      pendingSync = setTimeout(() => {
        pendingSync = null;
        syncBookingsToWidget();
      }, 250);
    });

    return () => {
      cleanupWidget();
      cleanupLiveActivity();
      unsubscribeCache();
      if (pendingSync !== null) clearTimeout(pendingSync);
    };
  }, [syncBookingsToWidget, isAuthenticated, queryClient]);

  return {
    syncBookingsToWidget,
    clearWidgetBookings,
  };
}
