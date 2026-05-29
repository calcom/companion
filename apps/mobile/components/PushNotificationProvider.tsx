import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deregisterPersistedPushRegistration,
  requestAndRegisterPushToken,
} from "@/hooks/use-push-notifications";

// How long the pre-logout callback waits for an in-flight registration to
// settle before deregistering, so a token that registered moments before
// logout still gets removed — without blocking the UI logout indefinitely.
const REGISTRATION_SETTLE_TIMEOUT_MS = 3000;

const LAST_HANDLED_NOTIF_KEY = "calcom_last_handled_notification_id";

// Show notifications even when the app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  const { isAuthenticated, userInfo, registerPreLogoutCallback } = useAuth();
  const router = useRouter();
  const registrationInFlightRef = useRef<Promise<unknown> | null>(null);
  const coldStartHandledRef = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const routerRef = useRef(router);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

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
      // Wait briefly for any in-flight registration to settle so a token that
      // registered moments before logout is persisted and thus deregistered.
      const inFlight = registrationInFlightRef.current;
      if (inFlight) {
        await Promise.race([
          inFlight.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, REGISTRATION_SETTLE_TIMEOUT_MS)),
        ]);
      }
      await deregisterPersistedPushRegistration(userIdRef.current ?? undefined);
    });
  }, [registerPreLogoutCallback]);

  // Handle notification taps (foreground + background).
  // Registered once — reads auth and router from refs to avoid teardown gaps.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
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
  }, []);

  // Handle cold-start: app was killed, user tapped notification to launch.
  // Wait for auth so the authenticated Stack is mounted before navigating.
  useEffect(() => {
    if (!isAuthenticated) return;

    if (coldStartHandledRef.current) return;
    coldStartHandledRef.current = true;

    void (async () => {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (!lastResponse) return;

      // Two-layer guard against re-navigating to an already-handled notification:
      // 1. AsyncStorage dedup — persists the handled ID across sessions so a
      //    previously-tapped notification can't replay on a fresh cold start.
      // 2. clearLastNotificationResponse() — clears the native cache so
      //    subsequent cold starts receive null rather than the old response.
      const id = lastResponse.notification.request.identifier;
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
  }, [isAuthenticated, router]);

  return <>{children}</>;
}
