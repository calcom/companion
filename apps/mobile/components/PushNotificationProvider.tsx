import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { deregisterPushToken, requestAndRegisterPushToken } from "@/hooks/use-push-notifications";

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
      router.push(`/(tabs)/(bookings)/booking-detail?uid=${uid}`);
    }
  } catch {
    // Malformed deep link — ignore.
  }
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { isAuthenticated, registerPreLogoutCallback } = useAuth();
  const router = useRouter();
  const registeredTokenRef = useRef<string | null>(null);

  // Register token on login.
  useEffect(() => {
    if (!isAuthenticated) {
      registeredTokenRef.current = null;
      return;
    }

    void (async () => {
      const result = await requestAndRegisterPushToken();
      if (result.success) {
        registeredTokenRef.current = result.token;
      }
    })();
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
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      if (url) {
        handleNotificationUrl(url, router);
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Handle cold-start: app was killed, user tapped notification to launch.
  useEffect(() => {
    void (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!lastResponse) return;

      const data = lastResponse.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const url = typeof data?.url === "string" ? data.url : undefined;
      if (url) {
        handleNotificationUrl(url, router);
      }
    })();
  }, [router]);

  return <>{children}</>;
}
