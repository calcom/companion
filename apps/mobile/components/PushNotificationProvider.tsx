import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { queryKeys } from "@/config/cache.config";
import {
  BOOKING_REQUEST_CATEGORY_ID,
  CONFIRM_BOOKING_REQUEST_ACTION_ID,
  DECLINE_BOOKING_REQUEST_ACTION_ID,
} from "@/constants/notifications";
import { useAuth } from "@/contexts/AuthContext";
import {
  deregisterPersistedPushRegistration,
  drainPendingDeregistrations,
  requestAndRegisterPushToken,
} from "@/hooks/use-push-notifications";
import { CalComAPIService } from "@/services/calcom";
import { showInfoAlert, showSuccessAlert } from "@/utils/alerts";

// How long the pre-logout callback waits for an in-flight registration to
// settle before deregistering, so a token that registered moments before
// logout still gets removed — without blocking the UI logout indefinitely.
const REGISTRATION_SETTLE_TIMEOUT_MS = 3000;

const LAST_HANDLED_NOTIF_KEY = "calcom_last_handled_notification_id";

// Persisted history of handled notification-action responses, keyed by
// `${notificationId}:${actionIdentifier}`. Survives across cold starts so a
// tapped Confirm/Decline can't replay when the OS hands us the launching
// response again. The in-memory mirror below is the synchronous source of
// truth within a single runtime.
const HANDLED_ACTIONS_KEY = "calcom_handled_notification_actions";

// Synchronous, runtime-local set of handled action keys. Checked-and-claimed
// before any `await` so the foreground listener and the cold-start path can
// never both submit the same Confirm/Decline (confirm is NOT idempotent on the
// backend — a duplicate throws "Booking already confirmed"). Hydrated from
// AsyncStorage on mount to also block cross-session replays.
const handledActionKeys = new Set<string>();
let handledActionsHydrated = false;

function actionDedupeKey(notificationId: string, actionIdentifier: string): string {
  return `${notificationId}:${actionIdentifier}`;
}

// Load persisted handled-action keys into the in-memory set. Idempotent; safe
// to await from multiple callers. The cold-start path must await this before
// claiming so a replayed action from a previous session is recognised.
async function hydrateHandledActions(): Promise<void> {
  if (handledActionsHydrated) return;
  try {
    const raw = await AsyncStorage.getItem(HANDLED_ACTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const key of parsed) {
          if (typeof key === "string") handledActionKeys.add(key);
        }
      }
    }
  } catch {
    // Corrupt/unavailable storage — the in-memory set still dedupes within this
    // runtime, and backend errors on duplicates surface as user feedback.
  } finally {
    handledActionsHydrated = true;
  }
}

// Synchronously claim an action key. Returns false if it was already handled in
// this runtime (no submit should happen). Must run with no `await` between the
// check and the add — that is what makes listener/cold-start races safe.
function claimActionKeySync(key: string): boolean {
  if (handledActionKeys.has(key)) return false;
  handledActionKeys.add(key);
  return true;
}

// Persist the claimed key optimistically (before the network call) so a crash
// or failure mid-mutation can't replay the action on a later cold start.
async function persistHandledActions(): Promise<void> {
  try {
    await AsyncStorage.setItem(HANDLED_ACTIONS_KEY, JSON.stringify([...handledActionKeys]));
  } catch {
    // Best-effort persistence; the in-memory set covers the current runtime.
  }
}

const BOOKING_REQUEST_ACTION_IDS = new Set<string>([
  CONFIRM_BOOKING_REQUEST_ACTION_ID,
  DECLINE_BOOKING_REQUEST_ACTION_ID,
]);

// Show notifications even when the app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushNotificationProviderProps {
  children: ReactNode;
}

function handleNotificationUrl(url: string, router: ReturnType<typeof useRouter>): void {
  try {
    const parsed = Linking.parse(url);
    const uid = typeof parsed.queryParams?.uid === "string" ? parsed.queryParams.uid : null;
    if (uid) {
      router.push(`/(tabs)/(bookings)/booking-detail?uid=${encodeURIComponent(uid)}`);
    }
  } catch {
    // Malformed deep link — ignore.
  }
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { isAuthenticated, loading, userInfo, registerPreLogoutCallback } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const registrationInFlightRef = useRef<Promise<unknown> | null>(null);
  const coldStartHandledRef = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const loadingRef = useRef(loading);
  const routerRef = useRef(router);
  const queryClientRef = useRef(queryClient);
  // Booking-request actions received while auth is still restoring are parked
  // here and replayed by the drain effect once `loading` settles. Keep a queue
  // so multiple actions cannot overwrite each other after they have already
  // been claimed in the dedupe set.
  const pendingActionsRef = useRef<Notifications.NotificationResponse[]>([]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  // Register the booking-request notification category so the OS renders the
  // Confirm/Decline buttons when a categorized push is expanded. Registered on
  // mount; a push arriving before this runs (e.g. very first launch after
  // install) may show no buttons until the category exists.
  useEffect(() => {
    void Notifications.setNotificationCategoryAsync(BOOKING_REQUEST_CATEGORY_ID, [
      {
        identifier: CONFIRM_BOOKING_REQUEST_ACTION_ID,
        buttonTitle: "Confirm",
        options: { opensAppToForeground: true, isAuthenticationRequired: true },
      },
      {
        identifier: DECLINE_BOOKING_REQUEST_ACTION_ID,
        buttonTitle: "Decline",
        options: {
          opensAppToForeground: true,
          isAuthenticationRequired: true,
          isDestructive: true,
        },
      },
    ]).catch(() => {
      // Native module unavailable or registration failed — default taps still
      // work; only the action buttons are affected.
    });
  }, []);

  // Run a Confirm/Decline action: open booking detail when we can't mutate
  // (missing auth or uid), otherwise call the API, surface feedback, and
  // refresh booking caches. Reads auth/router/queryClient from refs so it stays
  // stable across renders. Dedupe is the caller's responsibility.
  const executeBookingRequestAction = useCallback(
    async (response: Notifications.NotificationResponse): Promise<void> => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const bookingUid =
        typeof data?.bookingUid === "string" && data.bookingUid.length > 0
          ? data.bookingUid
          : undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      const actionId = response.actionIdentifier;

      // Can't mutate without an authenticated session and a target booking —
      // fall back to opening the booking detail if we have a deep link.
      if (!isAuthenticatedRef.current || !bookingUid) {
        if (url) {
          handleNotificationUrl(url, routerRef.current);
        }
        return;
      }

      const refresh = () =>
        Promise.all([
          queryClientRef.current.invalidateQueries({ queryKey: queryKeys.bookings.all }),
          queryClientRef.current.invalidateQueries({
            queryKey: queryKeys.bookings.detail(bookingUid),
          }),
        ]);

      try {
        if (actionId === CONFIRM_BOOKING_REQUEST_ACTION_ID) {
          await CalComAPIService.confirmBooking(bookingUid);
          showSuccessAlert("Success", "Booking confirmed successfully");
        } else if (actionId === DECLINE_BOOKING_REQUEST_ACTION_ID) {
          await CalComAPIService.declineBooking(bookingUid);
          showSuccessAlert("Success", "Booking declined successfully");
        } else {
          return;
        }
        await refresh();
      } catch (error) {
        // Includes the non-idempotent "Booking already confirmed" case — show
        // it as feedback rather than retrying, then refresh so the UI reflects
        // the booking's true server state. The action was triggered from a
        // notification (likely outside the app), so feedback must be visible on
        // native — showInfoAlert always surfaces, unlike the dev-only error alert.
        const message = error instanceof Error ? error.message : "Please try again.";
        showInfoAlert("Action failed", message);
        await refresh();
      }
    },
    []
  );

  // Claim and dispatch a notification-action response. Returns true when the
  // response is a booking-request action (handled or deduped), false for a
  // plain tap so the caller can fall through to deep-link navigation.
  const dispatchActionResponse = useCallback(
    (response: Notifications.NotificationResponse): boolean => {
      const actionId = response.actionIdentifier;
      if (!BOOKING_REQUEST_ACTION_IDS.has(actionId)) {
        return false;
      }

      const key = actionDedupeKey(response.notification.request.identifier, actionId);
      // Hydrate the persisted set before claiming so a cross-session replay (or
      // a launch response the listener receives before the cold-start effect
      // hydrates) is recognised. `claimActionKeySync` stays synchronous, so even
      // if the listener and cold-start paths both await hydration, whichever
      // resumes first claims and the other sees it claimed — single-threaded
      // resume keeps the double-submit guarantee intact. We return true
      // synchronously below so a plain-tap fallthrough is always suppressed.
      void (async () => {
        await hydrateHandledActions();
        if (!claimActionKeySync(key)) return;
        await persistHandledActions();

        if (loadingRef.current) {
          // Auth is still restoring; park the action and let the drain effect
          // run it once `loading` settles instead of treating it as
          // unauthenticated.
          pendingActionsRef.current.push(response);
          return;
        }

        void executeBookingRequestAction(response);
      })();
      return true;
    },
    [executeBookingRequestAction]
  );

  // Replay a parked action once auth finishes restoring.
  useEffect(() => {
    if (loading) return;
    const pending = pendingActionsRef.current;
    if (pending.length === 0) return;
    pendingActionsRef.current = [];
    for (const response of pending) {
      void executeBookingRequestAction(response);
    }
  }, [loading, executeBookingRequestAction]);

  // Register token on login. The registration promise is tracked in a ref so
  // the pre-logout callback can wait for an in-flight registration before
  // deregistering. requestAndRegisterPushToken persists a durable record on
  // success, which is what logout reads to deregister.
  const userId = userInfo?.id;
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    if (!isAuthenticated || userId == null) {
      return;
    }

    const promise = requestAndRegisterPushToken({ userId });
    registrationInFlightRef.current = promise;
    void promise.finally(() => {
      if (registrationInFlightRef.current === promise) {
        registrationInFlightRef.current = null;
      }
    });
  }, [isAuthenticated, userId]);

  // Deregister token before auth is cleared — the pre-logout callback runs
  // while the Bearer token is still valid so the API call succeeds. Reading
  // the persisted registration (instead of an in-memory ref) means logout can
  // still clean up the server subscription after an app restart.
  useEffect(() => {
    return registerPreLogoutCallback(async () => {
      // Snapshot the account being logged out BEFORE the settle wait. A relogin
      // landing during the wait could repoint userIdRef at a new account, which
      // would make us deregister/drain the wrong identity.
      const currentUserId = userIdRef.current;
      // Wait briefly for any in-flight registration to settle so a token that
      // registered moments before logout is persisted and thus deregistered.
      const inFlight = registrationInFlightRef.current;
      if (inFlight) {
        await Promise.race([
          inFlight.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, REGISTRATION_SETTLE_TIMEOUT_MS)),
        ]);
      }
      await deregisterPersistedPushRegistration(currentUserId ?? undefined);
      // A registration that settled in the wait above (after logout advanced
      // the generation) parks itself in the pending queue rather than the active
      // slot. Drain it now — while the Bearer token is still valid — so its
      // server subscription is deleted in this logout instead of lingering
      // until the next login for this user.
      if (currentUserId != null) {
        await drainPendingDeregistrations(currentUserId);
      }
    });
  }, [registerPreLogoutCallback]);

  // Handle notification taps (foreground + background).
  // Registered once — reads auth and router from refs to avoid teardown gaps.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      // Action responses are read and dispatched before the auth gate so a
      // Confirm/Decline tapped while auth is restoring can be deferred rather
      // than dropped.
      if (dispatchActionResponse(response)) return;

      // Plain tap — existing deep-link behavior, only when authenticated.
      if (!isAuthenticatedRef.current) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      if (url) {
        handleNotificationUrl(url, routerRef.current);
      }
    });

    return () => subscription.remove();
  }, [dispatchActionResponse]);

  // Handle cold-start: app was killed, user tapped notification to launch.
  // Wait for auth so the authenticated Stack is mounted before navigating.
  useEffect(() => {
    if (!isAuthenticated) return;

    if (coldStartHandledRef.current) return;
    coldStartHandledRef.current = true;

    void (async () => {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (!lastResponse) return;

      const id = lastResponse.notification.request.identifier;
      const actionId = lastResponse.actionIdentifier;

      // Cold-start via a Confirm/Decline button. Hydrate the persisted
      // handled-action set first so an action handled in a previous session
      // isn't replayed, then claim synchronously so the foreground listener
      // (which may also receive this launching response) can't double-submit.
      if (BOOKING_REQUEST_ACTION_IDS.has(actionId)) {
        await hydrateHandledActions();
        const key = actionDedupeKey(id, actionId);
        if (!claimActionKeySync(key)) return;
        await persistHandledActions();
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          // Native module unavailable — the dedupe set above still guards replay.
        }
        await executeBookingRequestAction(lastResponse);
        return;
      }

      // Plain tap. Two-layer guard against re-navigating to an already-handled
      // notification:
      // 1. AsyncStorage dedup — persists the handled ID across sessions so a
      //    previously-tapped notification can't replay on a fresh cold start.
      // 2. clearLastNotificationResponse() — clears the native cache so
      //    subsequent cold starts receive null rather than the old response.
      const lastHandledId = await AsyncStorage.getItem(LAST_HANDLED_NOTIF_KEY);
      if (lastHandledId === id) return;
      await AsyncStorage.setItem(LAST_HANDLED_NOTIF_KEY, id);
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Native module unavailable in some environments — AsyncStorage dedup above covers this.
      }

      const data = lastResponse.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      if (url) {
        handleNotificationUrl(url, router);
      }
    })();
  }, [isAuthenticated, router, executeBookingRequestAction]);

  return <>{children}</>;
}
