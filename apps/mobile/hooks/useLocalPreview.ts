import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyPreviewError,
  type LocalPreview,
  openLocalPreview,
  type PreviewStatus,
} from "@/services/cal-video/local-preview";

/**
 * Holds the camera open for the pre-join viewfinder, and only there. `release()` is handed to
 * the room hook so the stream is gone before any driver asks for the same camera.
 */
export function useLocalPreview({ active, cameraOn }: { active: boolean; cameraOn: boolean }) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const previewRef = useRef<LocalPreview | null>(null);
  const [attempt, setAttempt] = useState(0);

  const release = useCallback(() => {
    previewRef.current?.release();
    previewRef.current = null;
    setStreamUrl(null);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger
  useEffect(() => {
    if (!active || !cameraOn) {
      release();
      if (!active) setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("starting");
    openLocalPreview("front")
      .then((preview) => {
        if (cancelled) {
          preview.release();
          return;
        }
        previewRef.current = preview;
        setStreamUrl(preview.stream.toURL());
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(classifyPreviewError(error));
      });
    return () => {
      cancelled = true;
      release();
    };
  }, [active, cameraOn, attempt, release]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, streamUrl, release, retry };
}
