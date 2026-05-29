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
// Records we failed to deregister (offline, or belonging to a different
// region/user) are parked here instead of being dropped, so a later launch can
// retry their deletion. Keeps the single active-registration slot uncluttered
// while ensuring an unresolved subscription stays retryable.
const PENDING_DEREGISTRATIONS_KEY = "calcom_push_pending_deregistrations";

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
 * Two registrations refer to the same server subscription only when the full
 * identity tuple matches. Comparing the token alone misses cases where the same
 * token is re-used across a region/user change, so we compare all four fields.
 */
function isSameRegistration(a: PersistedPushRegistration, b: PersistedPushRegistration): boolean {
  return (
    a.token === b.token &&
    a.userId === b.userId &&
    a.region === b.region &&
    a.deviceId === b.deviceId
  );
}

async function getPendingDeregistrations(): Promise<PersistedPushRegistration[]> {
  try {
    const raw = await secureStorage.get(PENDING_DEREGISTRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedPushRegistration[]) : [];
  } catch {
    return [];
  }
}

async function setPendingDeregistrations(records: PersistedPushRegistration[]): Promise<void> {
  try {
    if (records.length === 0) {
      await secureStorage.remove(PENDING_DEREGISTRATIONS_KEY);
      return;
    }
    await secureStorage.set(PENDING_DEREGISTRATIONS_KEY, JSON.stringify(records));
  } catch {
    // Best-effort.
  }
}

async function enqueuePendingDeregistration(record: PersistedPushRegistration): Promise<void> {
  const pending = await getPendingDeregistrations();
  if (pending.some((r) => isSameRegistration(r, record))) return;
  await setPendingDeregistrations([...pending, record]);
}

/**
 * Best-effort retry of previously-unresolved deregistrations. Only attempts
 * records that belong to the CURRENT user AND region: the DELETE is
 * authenticated as the current user, so a 404 for a record owned by a different
 * user only means "not owned by this user" — not "already deleted" — and
 * dropping it would orphan that user's still-live subscription. Cross-user /
 * cross-region cleanup needs server-side global ownership, which is an explicit
 * non-goal. For owned records, a confirmed deletion or an authoritative 404
 * drops the record; everything else is kept for the next attempt.
 */
async function drainPendingDeregistrations(currentUserId: number): Promise<void> {
  const pending = await getPendingDeregistrations();
  if (pending.length === 0) return;

  const currentRegion = getRegion();
  const remaining: PersistedPushRegistration[] = [];
  for (const record of pending) {
    if (record.region !== currentRegion || record.userId !== currentUserId) {
      remaining.push(record);
      continue;
    }
    try {
      await CalComAPIService.removeAppPushSubscription(record.token);
    } catch (error) {
      // Authoritative: the record belongs to the authenticated current user,
      // so a 404 means the row is genuinely gone.
      if (error instanceof ApiRequestError && error.status === 404) {
        continue;
      }
      remaining.push(record);
      safeLogWarn(
        "[push] pending deregistration retry failed",
        await safeRegistrationLogContext(record)
      );
    }
  }
  await setPendingDeregistrations(remaining);
}

/**
 * Deregister the persisted push subscription on the server and clear the
 * persisted record only once the server confirms deletion. Returns true when
 * there is nothing left registered (either deletion succeeded or no record
 * existed). On failure the record is kept so a later attempt can retry, and
 * the caller is never blocked.
 *
 * `currentUserId` is the user the DELETE is authenticated as. It gates whether
 * a 404 can be treated as authoritative (see below).
 */
export async function deregisterPersistedPushRegistration(
  currentUserId?: number
): Promise<boolean> {
  const persisted = await getPersistedPushRegistration();
  if (!persisted) return true;

  try {
    await CalComAPIService.removeAppPushSubscription(persisted.token);
    await clearPersistedPushRegistration();
    return true;
  } catch (error) {
    // A 404 means "no such subscription for the authenticated user". It is only
    // authoritative ("genuinely gone") when the record was registered in the
    // current region AND belongs to the current user — the DELETE is authed as
    // `currentUserId`, so a 404 for a different user's record only means "not
    // owned by this user", not "deleted". Cross-region records are likewise
    // unresolvable here. Keep anything we can't authoritatively confirm so the
    // caller can re-queue it for a session that can.
    if (error instanceof ApiRequestError && error.status === 404) {
      const ownedByCurrentUser = currentUserId != null && persisted.userId === currentUserId;
      if (persisted.region === getRegion() && ownedByCurrentUser) {
        await clearPersistedPushRegistration();
        return true;
      }
      safeLogWarn(
        "[push] unregister 404 not authoritative for this session; keeping record",
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

  // Capture the auth session at the start. If the user logs out or switches
  // accounts while registration is in flight, the generation changes and we
  // must not persist this as an active registration for a now-dead session.
  const generationAtStart = CalComAPIService.getAuthGeneration();

  // Retry any earlier deregistrations that couldn't be resolved (e.g. an
  // offline logout) now that we're authenticated and online again.
  await drainPendingDeregistrations(params.userId);

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

  const newRecord: PersistedPushRegistration = {
    token,
    deviceId,
    platform,
    region: getRegion(),
    userId: params.userId,
    registeredAt: new Date().toISOString(),
  };

  // The session was logged out or switched while this registration was in
  // flight. Do NOT persist it as the active registration — that would leave a
  // logged-out (or previous) user's subscription live in our local state.
  // Park it for retry instead; the backend's same-device dedup also clears it
  // on the next login for this device.
  if (CalComAPIService.getAuthGeneration() !== generationAtStart) {
    await enqueuePendingDeregistration(newRecord);
    safeLogWarn(
      "[push] registration completed after logout/account switch; queued for cleanup",
      await safeRegistrationLogContext(newRecord)
    );
    return { success: false, reason: "auth-session-changed-during-registration", token };
  }

  // There is a single active persisted registration slot. If a previous record
  // refers to a different subscription (different token/user/region/device),
  // try to deregister it before overwriting. If it can't be resolved now
  // (offline, or a different region/user), park it for retry instead of
  // silently dropping it — otherwise the old subscription becomes unretryable.
  const previous = await getPersistedPushRegistration();
  if (previous && !isSameRegistration(previous, newRecord)) {
    const resolved = await deregisterPersistedPushRegistration(params.userId);
    if (!resolved) {
      await enqueuePendingDeregistration(previous);
      safeLogWarn(
        "[push] queued unresolved previous registration for retry",
        await safeRegistrationLogContext(previous)
      );
    }
  }

  await persistPushRegistration(newRecord);

  return { success: true, token };
}
