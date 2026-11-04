/**
 * Keeps the iOS "next call" Live Activity in step with the bookings the app knows about.
 *
 * iOS only lets an app start a Live Activity while it is in the foreground, so this module
 * starts it on sync when the next call is within the lead window, and otherwise arms a timer
 * for the moment the window opens in case the app is still open then. Ending and updating
 * work from the background too, so a running activity is cleaned up on the next sync.
 */
import { AppState, type AppStateStatus, Platform } from "react-native";
import { endLiveActivity, startOrUpdateLiveActivity } from "@/modules/next-call-live-activity";
import type { Booking } from "@/services/types/bookings.types";
import { planNextCallLiveActivity } from "@/utils/next-call-live-activity";

/** Timers further out than this are pointless: the app will not stay open that long. */
const MAX_TIMER_MS = 12 * 60 * 60 * 1000;

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function armTimer(delayMs: number, run: () => void): void {
  clearTimer();
  if (delayMs > MAX_TIMER_MS) return;
  timer = setTimeout(
    () => {
      timer = null;
      run();
    },
    Math.max(0, delayMs)
  );
}

export async function syncNextCallLiveActivity(
  bookings: readonly Booking[],
  now: Date = new Date()
): Promise<void> {
  if (Platform.OS !== "ios") return;
  clearTimer();

  const plan = planNextCallLiveActivity(bookings, now);
  const resync = () => {
    syncNextCallLiveActivity(bookings).catch((error) => {
      console.warn("Failed to refresh next-call Live Activity:", error);
    });
  };

  if (plan.action === "show") {
    try {
      await startOrUpdateLiveActivity(plan.payload);
    } catch (error) {
      // Expected when called from the background; the next foreground sync retries.
      console.warn("Failed to start next-call Live Activity:", error);
    }
    // Re-plan once the call ends so the activity is dismissed and the next one queued.
    armTimer(plan.endsAt.getTime() - now.getTime() + 1000, resync);
    return;
  }

  try {
    await endLiveActivity();
  } catch (error) {
    console.warn("Failed to end next-call Live Activity:", error);
  }
  if (plan.action === "wait") {
    armTimer(plan.startAt.getTime() - now.getTime(), resync);
  }
}

/** Ends any running activity and drops pending timers (sign-out). */
export async function clearNextCallLiveActivity(): Promise<void> {
  clearTimer();
  if (Platform.OS !== "ios") return;
  await endLiveActivity();
}

/** Re-runs `resync` whenever the app returns to the foreground, where activities can start. */
export function setupNextCallLiveActivityRefresh(resync: () => Promise<void>): () => void {
  if (Platform.OS !== "ios") return () => {};
  const onChange = (state: AppStateStatus) => {
    if (state === "active") {
      resync().catch((error) => {
        console.warn("Failed to refresh next-call Live Activity on foreground:", error);
      });
    }
  };
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
}
