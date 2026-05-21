import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CalComAPIService } from "@/services/calcom";

export type PushRegistrationResult =
  | { success: true; token: string }
  | { success: false; reason: string };

function getDeviceId(): string {
  return Device.osBuildId ?? Device.osInternalBuildId ?? `${Device.modelId ?? "unknown"}-fallback`;
}

function getPlatform(): "IOS" | "ANDROID" {
  return Platform.OS === "ios" ? "IOS" : "ANDROID";
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function requestAndRegisterPushToken(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { success: false, reason: "simulators-do-not-support-push-notifications" };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
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

  try {
    await CalComAPIService.registerAppPushSubscription({
      token,
      platform: getPlatform(),
      deviceId: getDeviceId(),
    });
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : "server-registration-failed",
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
