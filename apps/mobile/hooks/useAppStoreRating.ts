import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";
import { Platform } from "react-native";

/**
 * Rating triggers - add new triggers here as needed.
 * Each trigger will only prompt the user once (tracked via AsyncStorage).
 */
export const RatingTrigger = {
  EVENT_TYPE_SAVED: "event_type_saved",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_REJECTED: "booking_rejected",
} as const;

export type RatingTriggerType = (typeof RatingTrigger)[keyof typeof RatingTrigger];

const STORAGE_KEY_PREFIX = "app_rating_triggered_";

function getStorageKey(trigger: RatingTriggerType): string {
  return `${STORAGE_KEY_PREFIX}${trigger}`;
}

async function requestReviewIfAvailable(): Promise<boolean> {
  // Review prompts are a production-only, best-effort native feature.
  if (__DEV__ || Platform.OS === "web") {
    return false;
  }

  try {
    // Dynamic import to avoid bundling issues on web
    const StoreReview = await import("expo-store-review");
    const hasReviewAction = await StoreReview.hasAction();
    if (!hasReviewAction) {
      return false;
    }

    await StoreReview.requestReview();
    return true;
  } catch (_error) {
    return false;
  }
}

async function hasAlreadyTriggered(trigger: RatingTriggerType): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(getStorageKey(trigger));
    return value === "true";
  } catch (error) {
    console.warn("Failed to check rating trigger status:", error);
    return false;
  }
}

async function markAsTriggered(trigger: RatingTriggerType): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(trigger), "true");
  } catch (error) {
    console.warn("Failed to mark rating as triggered:", error);
  }
}

/**
 * Request an app store rating for a specific trigger.
 * Only prompts the user once per trigger type.
 *
 * @param trigger - The trigger type from RatingTrigger
 * @returns true if the rating dialog was shown, false otherwise
 *
 * @example
 * // Request rating after first event type save
 * await requestRating(RatingTrigger.EVENT_TYPE_SAVED);
 *
 * // Request rating after first booking confirmation
 * await requestRating(RatingTrigger.BOOKING_CONFIRMED);
 */
export async function requestRating(trigger: RatingTriggerType): Promise<boolean> {
  if (__DEV__ || Platform.OS === "web") {
    return false;
  }

  const alreadyTriggered = await hasAlreadyTriggered(trigger);
  if (alreadyTriggered) {
    return false;
  }

  const didRequestReview = await requestReviewIfAvailable();
  if (didRequestReview) {
    await markAsTriggered(trigger);
  }
  return didRequestReview;
}

/**
 * Hook for requesting app store ratings.
 * Provides a memoized callback for use in React components.
 */
export function useAppStoreRating() {
  const requestRatingCallback = useCallback(
    async (trigger: RatingTriggerType): Promise<boolean> => {
      return requestRating(trigger);
    },
    []
  );

  return {
    requestRating: requestRatingCallback,
    RatingTrigger,
  };
}
