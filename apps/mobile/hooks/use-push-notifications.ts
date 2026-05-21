import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CalComAPIService } from "@/services/calcom";
import { secureStorage } from "@/utils/storage";

const DEVICE_ID_KEY = "calcom_push_device_id";

export type PushRegistrationResult =
  | { success: true; token: string }
  | { success: false; reason: string; token?: string };

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

export async function requestAndRegisterPushToken(): Promise<PushRegistrationResult> {
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

  try {
    await CalComAPIService.registerAppPushSubscription({
      token,
      platform: getPlatform(),
      deviceId,
    });
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "server-registration-failed",
      token,
    };
  }

  return { success: true, token };
}

export async function deregisterPushToken(token: string): Promise<void> {
  try {
    await CalComAPIService.removeAppPushSubscription(token);
  } catch {
    // Best-effort: server cleans up stale tokens on failed send attempts.
  }
}
