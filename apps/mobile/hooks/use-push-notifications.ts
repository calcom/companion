import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CalComAPIService } from "@/services/calcom";
import { type CalRegion, getRegion } from "@/utils/region";
import { secureStorage } from "@/utils/storage";

const DEVICE_ID_KEY = "calcom_push_device_id";
const PERSISTED_REGISTRATION_KEY = "calcom_push_registration";

export type PushRegistrationResult =
  | { success: true; token: string }
  | { success: false; reason: string; token?: string };

/**
 * A durable record of the last successful server-side push registration.
 * Persisted to secure storage so logout (even after an app restart, when the
 * in-memory token ref is gone) can still deregister the server subscription.
 */
export type PersistedPushRegistration = {
  token: string;
  deviceId: string;
  platform: "IOS" | "ANDROID";
  region: CalRegion;
  userId: number;
  registeredAt: string;
};

export async function getPersistedPushRegistration(): Promise<PersistedPushRegistration | null> {
  try {
    const raw = await secureStorage.get(PERSISTED_REGISTRATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedPushRegistration;
  } catch {
    return null;
  }
}

async function persistPushRegistration(record: PersistedPushRegistration): Promise<void> {
  try {
    await secureStorage.set(PERSISTED_REGISTRATION_KEY, JSON.stringify(record));
  } catch {
    // Best-effort: cross-restart deregistration is a hardening nicety, not
    // critical to the login flow.
  }
}

export async function clearPersistedPushRegistration(): Promise<void> {
  try {
    await secureStorage.remove(PERSISTED_REGISTRATION_KEY);
  } catch {
    // Best-effort.
  }
}

/**
 * Deregister the persisted push subscription on the server and clear the
 * persisted record only once the server confirms deletion. Returns true when
 * there is nothing left registered (either deletion succeeded or no record
 * existed). On failure the record is kept so a later attempt can retry, and
 * the caller is never blocked.
 */
export async function deregisterPersistedPushRegistration(): Promise<boolean> {
  const persisted = await getPersistedPushRegistration();
  if (!persisted) return true;

  try {
    await CalComAPIService.removeAppPushSubscription(persisted.token);
    await clearPersistedPushRegistration();
    return true;
  } catch {
    // Keep the persisted record; the server prunes stale tokens on failed
    // sends, and a future logout/launch can retry deletion.
    return false;
  }
}

async function getDeviceId(): Promise<string> {
  let id: string | undefined;
  try {
    const stored = await secureStorage.get(DEVICE_ID_KEY);
    if (stored) return stored;

    id = Crypto.randomUUID();
    await secureStorage.set(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return id ?? Crypto.randomUUID();
  }
}

function getPlatform(): "IOS" | "ANDROID" {
  return Platform.OS === "ios" ? "IOS" : "ANDROID";
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch {
      // Best-effort; proceed without custom channel.
    }
  }
}

export async function requestAndRegisterPushToken(params: {
  userId: number;
}): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { success: false, reason: "simulators-do-not-support-push-notifications" };
  }

  let finalStatus: Notifications.PermissionStatus;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "permission-request-failed",
    };
  }

  if (finalStatus !== "granted") {
    return { success: false, reason: "notification-permission-denied" };
  }

  await ensureAndroidChannel();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { success: false, reason: "missing-expo-project-id" };
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "failed-to-get-expo-push-token",
    };
  }

  const deviceId = await getDeviceId();

  const platform = getPlatform();

  try {
    await CalComAPIService.registerAppPushSubscription({
      token,
      platform,
      deviceId,
    });
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "server-registration-failed",
      token,
    };
  }

  await persistPushRegistration({
    token,
    deviceId,
    platform,
    region: getRegion(),
    userId: params.userId,
    registeredAt: new Date().toISOString(),
  });

  return { success: true, token };
}
