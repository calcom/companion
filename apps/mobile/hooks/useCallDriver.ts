import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createCallDriver } from "@/services/cal-video/call-driver/create-call-driver";
import {
  type CallDriver,
  type CallDriverOptions,
  type CallState,
  initialCallState,
  type JoinGrant,
  type JoinOptions,
} from "@/services/cal-video/types";
import { safeLogWarn } from "@/utils/safeLogger";

const NO_CAPABILITIES = {
  canRecord: false,
  canTranscribe: false,
  canScreenShare: false,
  canPublishVideo: false,
  canChat: false,
  canAdmit: false,
  canEndForEveryone: false,
  canRemoveParticipant: false,
  maxParticipants: 1,
};

const IDLE_STATE: CallState = { ...initialCallState(NO_CAPABILITIES), cameraFacing: null };

const noopSubscribe = () => () => undefined;
const getIdle = () => IDLE_STATE;

/**
 * One driver per grant: built when a grant arrives, joined at once, destroyed when the grant goes
 * away or the screen unmounts. `onUnsupported` fires when this build has no driver for the grant's
 * provider, so the UI can send the person to the browser instead of a spinner.
 */
export function useCallDriver({
  grant,
  joinOptions,
  driverOptions,
  onUnsupported,
}: {
  grant: JoinGrant | null;
  joinOptions: JoinOptions;
  /** What the driver needs from the room API; read when the driver is built, like `joinOptions`. */
  driverOptions?: CallDriverOptions;
  onUnsupported: (message: string) => void;
}): { driver: CallDriver | null; state: CallState } {
  const [driver, setDriver] = useState<CallDriver | null>(null);
  // The options at the moment of joining; later toggles go through the driver, not a re-join.
  const joinOptionsRef = useRef(joinOptions);
  const driverOptionsRef = useRef(driverOptions);
  const onUnsupportedRef = useRef(onUnsupported);
  useEffect(() => {
    joinOptionsRef.current = joinOptions;
    driverOptionsRef.current = driverOptions;
    onUnsupportedRef.current = onUnsupported;
  }, [joinOptions, driverOptions, onUnsupported]);

  useEffect(() => {
    if (!grant) {
      setDriver(null);
      return;
    }
    let cancelled = false;
    let created: CallDriver | null = null;
    createCallDriver(grant, driverOptionsRef.current)
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        created = next;
        setDriver(next);
        return next.join(joinOptionsRef.current);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        safeLogWarn("[CalVideo] call driver failed", { error: String(error) });
        onUnsupportedRef.current(
          error instanceof Error ? error.message : "This meeting cannot be joined from the app."
        );
      });
    return () => {
      cancelled = true;
      created?.destroy();
      setDriver(null);
    };
  }, [grant]);

  const state = useSyncExternalStore(
    driver ? driver.subscribe : noopSubscribe,
    driver ? driver.getState : getIdle,
    driver ? driver.getState : getIdle
  );

  return { driver, state };
}
