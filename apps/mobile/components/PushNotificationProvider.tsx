import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { deregisterPushToken, requestAndRegisterPushToken } from "@/hooks/use-push-notifications";

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
  const { isAuthenticated, registerPreLogoutCallback } = useAuth();
  const router = useRouter();
  const registeredTokenRef = useRef<string | null>(null);
  const coldStartHandledRef = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const routerRef = useRef(router);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Register token on login.
  // Register token on login.
  useEffect(() => {
    if (!isAuthenticated) {
      registeredTokenRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await requestAndRegisterPushToken();
      if (cancelled) return;
      if (result.success) {
        registeredTokenRef.current = result.token;
      } else if (result.token) {
        // Server registration failed but token was obtained — store it so
        // we can still deregister on logout.
        registeredTokenRef.current = result.token;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Deregister token before auth is cleared — the pre-logout callback runs
  // while the Bearer token is still valid so the API call succeeds.
  useEffect(() => {
    return registerPreLogoutCallback(async () => {
      if (registeredTokenRef.current) {
        await deregisterPushToken(registeredTokenRef.current);
        registeredTokenRef.current = null;
      }
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
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!lastResponse) return;

      // Skip if this notification was already handled in a previous session.
      // getLastNotificationResponseAsync() persists across launches, so without
      // this check the same tap would re-navigate every time the app cold-starts.
      const id = lastResponse.notification.request.identifier;
      const lastHandledId = await AsyncStorage.getItem(LAST_HANDLED_NOTIF_KEY);
      if (lastHandledId === id) return;
      await AsyncStorage.setItem(LAST_HANDLED_NOTIF_KEY, id);

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
