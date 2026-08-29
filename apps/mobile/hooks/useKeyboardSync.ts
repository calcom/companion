import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { queryKeys } from "@/config/cache.config";
import { useAuth } from "@/contexts/AuthContext";
import { CalComAPIService, type EventType } from "@/services/calcom";
import {
  clearKeyboardData,
  transformToKeyboardData,
  updateKeyboardData,
} from "@/utils/keyboardStorage";
import { getCalAppUrl } from "@/utils/region";

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
let lastSuccessfulSyncAt = 0;

export function useKeyboardSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated, userInfo } = useAuth();

  const syncKeyboardData = useCallback(async () => {
    if (
      Platform.OS === "web" ||
      !isAuthenticated ||
      Date.now() - lastSuccessfulSyncAt < SYNC_INTERVAL_MS
    ) {
      return;
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cachedEventTypes = queryClient.getQueryData<EventType[]>(queryKeys.eventTypes.lists());
    const eventTypes = cachedEventTypes ?? (await CalComAPIService.getEventTypes());
    const visibleEventTypes = eventTypes.filter((eventType) => !eventType.hidden).slice(0, 10);
    if (visibleEventTypes.length === 0) {
      await updateKeyboardData({
        links: [],
        timeZone,
        lastUpdated: new Date().toISOString(),
      });
      lastSuccessfulSyncAt = Date.now();
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    const slotsByEventType: Record<string, Array<{ start: string }>> = {};

    for (const eventType of visibleEventTypes) {
      slotsByEventType[String(eventType.id)] = await CalComAPIService.getAvailableSlots({
        eventTypeId: eventType.id,
        start: start.toISOString(),
        end: end.toISOString(),
        timeZone,
      });
    }

    const fallbackUsername = visibleEventTypes.some((eventType) => !eventType.bookingUrl)
      ? (userInfo?.username ?? (await CalComAPIService.getUserProfile()).username)
      : null;
    const data = transformToKeyboardData({
      eventTypes: visibleEventTypes,
      slotsByEventType,
      timeZone,
      bookingUrlForEventType: (eventType) =>
        eventType.bookingUrl ?? `${getCalAppUrl()}/${fallbackUsername}/${eventType.slug}`,
    });
    await updateKeyboardData(data);
    lastSuccessfulSyncAt = Date.now();
  }, [isAuthenticated, queryClient, userInfo?.username]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    if (!isAuthenticated) {
      clearKeyboardData().catch((error) => {
        console.warn("Failed to clear keyboard data:", error);
      });
      lastSuccessfulSyncAt = 0;
      return;
    }

    syncKeyboardData().catch((error) => {
      console.warn("Failed to sync keyboard data:", error);
    });
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        syncKeyboardData().catch((error) => {
          console.warn("Failed to sync keyboard data on foreground:", error);
        });
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, syncKeyboardData]);

  return { syncKeyboardData, clearKeyboardData };
}
