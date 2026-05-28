import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CalComAPIService } from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";
import { type CalRegion, getRegion } from "@/utils/region";
import { safeLogWarn } from "@/utils/safeLogger";
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

/**
 * Stable, non-reversible short hash of an Expo push token, safe to log.
 * Never log the raw token (it is PII / a routing credential).
 */
async function hashPushToken(token: string): Promise<string> {
  try {
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
    return digest.slice(0, 16);
  } catch {
    return "unhashable";
  }
}

async function safeRegistrationLogContext(
  registration: PersistedPushRegistration
): Promise<Record<string, unknown>> {
  return {
    currentRegion: getRegion(),
    persistedRegion: registration.region,
    userId: registration.userId,
    deviceId: registration.deviceId,
    tokenHash: await hashPushToken(registration.token),
  };
}

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
  } catch (error) {
    // A 404 means the server has no such subscription. If it was registered in
    // the region we're currently talking to, it is genuinely gone (e.g. pruned
    // by invalid-token cleanup), so clear the stale record. If the persisted
    // region differs, the 404 only means "not in this region" — we can't safely
    // resolve it until cross-region ownership lands, so keep the record.
    if (error instanceof ApiRequestError && error.status === 404) {
      if (persisted.region === getRegion()) {
        await clearPersistedPushRegistration();
        return true;
      }
      safeLogWarn(
        "[push] unregister 404 for a different region; keeping record",
        await safeRegistrationLogContext(persisted)
      );
      return false;
    }
    // Keep the persisted record; a future logout/launch can retry deletion.
    safeLogWarn(
      "[push] failed to deregister persisted token",
      await safeRegistrationLogContext(persisted)
    );
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

  // There is a single persisted registration slot. If a previous record exists
  // for a different token (e.g. a token whose deregistration failed earlier),
  // try to resolve it before we overwrite it, so the old subscription isn't
  // silently orphaned. If it can't be resolved now, deregister logs it safely.
  const previous = await getPersistedPushRegistration();
  if (previous && previous.token !== token) {
    const resolved = await deregisterPersistedPushRegistration();
    if (!resolved) {
      safeLogWarn(
        "[push] overwriting an unresolved previous registration",
        await safeRegistrationLogContext(previous)
      );
    }
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
