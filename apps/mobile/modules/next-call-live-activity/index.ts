import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { NextCallLiveActivityPayload } from "./types";

export type { NextCallLiveActivityPayload } from "./types";

interface NativeModule {
  startOrUpdate(payload: NextCallLiveActivityPayload): Promise<string>;
  end(uid: string | null): Promise<void>;
}

const native =
  Platform.OS === "ios" ? requireOptionalNativeModule<NativeModule>("NextCallLiveActivity") : null;

/** Resolves with the activity id, or null when Live Activities are unavailable on this build. */
export async function startOrUpdateLiveActivity(
  payload: NextCallLiveActivityPayload
): Promise<string | null> {
  if (!native) return null;
  return native.startOrUpdate(payload);
}

/** Ends the activity for one booking, or all next-call activities when no uid is given. */
export async function endLiveActivity(uid?: string): Promise<void> {
  if (!native) return;
  await native.end(uid ?? null);
}
