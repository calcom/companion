/**
 * The pre-join camera preview.
 *
 * Opened straight from WebRTC rather than through a call object, so no provider is chosen — and
 * no vendor session minted — before the person has pressed Join. Released before the driver
 * starts: two streams competing for one camera is how you get "device in use".
 */
import { type MediaStream, mediaDevices } from "@cloudflare/react-native-webrtc";

export type PreviewStatus = "idle" | "starting" | "ready" | "denied" | "unavailable";

export interface LocalPreview {
  stream: MediaStream;
  release(): void;
}

export async function openLocalPreview(facing: "front" | "back" = "front"): Promise<LocalPreview> {
  const stream = (await mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing === "front" ? "user" : "environment" },
  })) as MediaStream;
  return {
    stream,
    release: () => {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Already stopped.
        }
      }
      try {
        stream.release?.();
      } catch {
        // Not every build exposes release().
      }
    },
  };
}

export function classifyPreviewError(
  error: unknown
): Exclude<PreviewStatus, "idle" | "starting" | "ready"> {
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (name === "NotAllowedError" || name === "SecurityError" || message.includes("permission")) {
    return "denied";
  }
  return "unavailable";
}
