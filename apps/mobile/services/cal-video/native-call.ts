/**
 * The system's own call surface: CallKit on iOS, a self-managed Telecom ConnectionService on
 * Android, both through react-native-callkeep.
 *
 * Reporting a Cal Video call here is what makes it behave like a phone call to the OS — the
 * audio session is treated as a call, incoming cellular calls are negotiated instead of
 * stomping on it, the mute button on a Bluetooth headset works, and the green status pill
 * takes you back. Nothing here carries media; the driver does that.
 *
 * Everything is best-effort: a build without the native module (Expo Go, web) degrades to a
 * plain in-app call.
 */
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { safeLogWarn } from "@/utils/safeLogger";

type CallKeepModule = typeof import("react-native-callkeep").default;
type CallKeepConstants = typeof import("react-native-callkeep").CONSTANTS;
type CallKeepListener = { remove(): void };

let callKeep: CallKeepModule | null = null;
let callKeepConstants: CallKeepConstants | null = null;
let setupPromise: Promise<boolean> | null = null;

function loadCallKeep(): CallKeepModule | null {
  if (callKeep) return callKeep;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  try {
    // Required lazily so a bundle without the native module still loads.
    const loaded = require("react-native-callkeep") as {
      default: CallKeepModule;
      CONSTANTS: CallKeepConstants;
    };
    callKeep = loaded.default;
    callKeepConstants = loaded.CONSTANTS;
    return callKeep;
  } catch {
    return null;
  }
}

function setupOnce(): Promise<boolean> {
  if (setupPromise) return setupPromise;
  const module = loadCallKeep();
  if (!module) return Promise.resolve(false);
  setupPromise = module
    .setup({
      ios: {
        appName: "Cal.com",
        supportsVideo: true,
        maximumCallGroups: "1",
        maximumCallsPerCallGroup: "1",
        includesCallsInRecents: false,
      },
      android: {
        alertTitle: "Phone account permission",
        alertDescription: "Cal.com needs this to show your video calls as calls.",
        cancelButton: "Cancel",
        okButton: "OK",
        additionalPermissions: [],
        // No phone-account dialog and no dialer integration: the app manages its own calls.
        selfManaged: true,
        foregroundService: {
          channelId: "cal-video-call",
          channelName: "Cal Video calls",
          notificationTitle: "Cal Video call in progress",
        },
      },
    })
    .then(() => true)
    .catch((error: unknown) => {
      safeLogWarn("[CalVideo] CallKeep setup failed", { error: String(error) });
      return false;
    });
  return setupPromise;
}

export interface NativeCallHandlers {
  /** The person ended the call from the system UI (lock screen, CallKit, a headset button). */
  onEndCall(): void;
  /** The system muted or unmuted the call. */
  onSetMuted(muted: boolean): void;
}

export interface StartNativeCallInput {
  /** What the system shows as the callee: `i.cal.video/peer`. */
  handle: string;
  /** A friendlier title where the OS allows one: the room's display name. */
  displayName: string;
  hasVideo: boolean;
}

export type NativeCallEndReason = "local" | "remote" | "failed";

/**
 * One call as the OS sees it. Lives from the moment we have a grant until the call is over,
 * whichever side ended it.
 */
/** How long after accepting a call CallKit may still back out of it; an end this soon is not a hang-up. */
const REFUSAL_WINDOW_MS = 2000;

/** Whether the system ending a call means CallKit backed out, rather than the person hanging up. */
export function isCallKitBackingOut(input: {
  mediaConnected: boolean;
  acceptedAt: number;
  now: number;
}): boolean {
  return !input.mediaConnected || input.now - input.acceptedAt < REFUSAL_WINDOW_MS;
}

export class NativeCallSession {
  readonly uuid = randomUUID();
  private listeners: CallKeepListener[] = [];
  private started = false;
  private startedAt = 0;
  private acceptedAt = 0;
  private connectedReported = false;
  private mediaConnected = false;
  private ended = false;

  constructor(private readonly handlers: NativeCallHandlers) {}

  async start(input: StartNativeCallInput): Promise<boolean> {
    const module = loadCallKeep();
    if (!module || !(await setupOnce()) || this.ended) return false;
    try {
      this.listeners.push(
        // CallKit accepted the call: report it connected at once. A call left in its initial or
        // "connecting" state is torn down by the system within a fraction of a second (seen on
        // the Simulator), so the system timer starts a moment before media flows. Acceptable.
        module.addEventListener("didReceiveStartCallAction", ({ callUUID }) => {
          if (!this.matches(callUUID) || this.connectedReported || Platform.OS !== "ios") return;
          this.acceptedAt = Date.now();
          try {
            module.reportConnectedOutgoingCallWithUUID(this.uuid);
            this.connectedReported = true;
          } catch {
            // Cosmetic.
          }
        }),
        module.addEventListener("endCall", ({ callUUID }) => {
          if (!this.matches(callUUID)) return;
          // The system ending a call before media flows, or just after accepting it, is CallKit
          // backing out, not a hang-up; iOS reports connected on the start action, so that flag
          // cannot tell. CallKit can answer seconds late, so the window runs from its acceptance.
          const acceptedAt = this.acceptedAt || this.startedAt;
          if (
            isCallKitBackingOut({
              mediaConnected: this.mediaConnected,
              acceptedAt,
              now: Date.now(),
            })
          ) {
            safeLogWarn("[CalVideo] CallKit ended the call before it connected; continuing in-app");
            this.started = false;
            this.detach();
            return;
          }
          this.handlers.onEndCall();
        }),
        module.addEventListener("didPerformSetMutedCallAction", ({ callUUID, muted }) => {
          if (this.matches(callUUID)) this.handlers.onSetMuted(muted);
        }),
        // CallKit refused the call (the iOS Simulator answers every CXStartCallAction with
        // "Unentitled"). Forget the call so later mute/end reports do not target an unknown UUID.
        module.addEventListener("startCallFailed", ({ callUUID, errorCode, error }) => {
          if (!this.matches(callUUID)) return;
          safeLogWarn("[CalVideo] CallKit rejected the call; continuing without system call UI", {
            errorCode: errorCode ?? "Unknown",
            error: error ?? "",
          });
          this.started = false;
          this.detach();
        })
      );
      this.startedAt = Date.now();
      module.startCall(this.uuid, input.handle, input.displayName, "generic", input.hasVideo);
      this.started = true;
      return true;
    } catch (error) {
      safeLogWarn("[CalVideo] CallKeep startCall failed", { error: String(error) });
      this.detach();
      return false;
    }
  }

  /** The media is flowing: the system stops showing "connecting". */
  connected(): void {
    this.mediaConnected = true;
    const module = loadCallKeep();
    if (!module || !this.started || this.ended) return;
    try {
      if (Platform.OS === "ios") module.reportConnectedOutgoingCallWithUUID(this.uuid);
      else module.setCurrentCallActive(this.uuid);
      this.connectedReported = true;
    } catch (error) {
      safeLogWarn("[CalVideo] CallKeep connected failed", { error: String(error) });
    }
  }

  /** Mirrors an in-app mute into the system UI so the two never disagree. */
  setMuted(muted: boolean): void {
    const module = loadCallKeep();
    if (!module || !this.started || this.ended) return;
    try {
      module.setMutedCall(this.uuid, muted);
    } catch {
      // Cosmetic.
    }
  }

  end(reason: NativeCallEndReason): void {
    if (this.ended) return;
    this.ended = true;
    const module = loadCallKeep();
    if (module && this.started) {
      try {
        if (reason === "local") module.endCall(this.uuid);
        else {
          const reasons = callKeepConstants?.END_CALL_REASONS;
          module.reportEndCallWithUUID(
            this.uuid,
            reason === "failed" ? (reasons?.FAILED ?? 1) : (reasons?.REMOTE_ENDED ?? 2)
          );
        }
      } catch (error) {
        safeLogWarn("[CalVideo] CallKeep endCall failed", { error: String(error) });
      }
    }
    this.detach();
  }

  private matches(callUUID: string | undefined): boolean {
    return typeof callUUID === "string" && callUUID.toLowerCase() === this.uuid.toLowerCase();
  }

  private detach(): void {
    for (const listener of this.listeners) {
      try {
        listener.remove();
      } catch {
        // Already removed.
      }
    }
    this.listeners = [];
  }
}

export function isNativeCallSupported(): boolean {
  return loadCallKeep() !== null;
}
