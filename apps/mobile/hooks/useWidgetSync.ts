import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { queryKeys } from "@/config/cache.config";
import { useAuth } from "@/contexts/AuthContext";
import { type Booking, CalComAPIService } from "@/services/calcom";
import {
  clearWidgetBookings,
  setupWidgetRefreshOnAppStateChange,
  updateWidgetBookings,
} from "@/utils/widgetStorage";

export function useWidgetSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

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

    let cachedBookings: Booking[] | undefined;
    for (const filters of possibleFilters) {
      const cached = queryClient.getQueryData<Booking[]>(queryKeys.bookings.list(filters));
      if (cached !== undefined && cached.length > 0) {
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
      } catch (error) {
        console.warn("Failed to fetch and sync bookings to widget:", error);
      }
    }
  }, [queryClient]);

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

    const cleanup = setupWidgetRefreshOnAppStateChange(syncBookingsToWidget);

    return cleanup;
  }, [syncBookingsToWidget, isAuthenticated]);

  return {
    syncBookingsToWidget,
    clearWidgetBookings,
  };
}
