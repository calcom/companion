import { type CallDriver, CalVideoError, type SfuJoinGrant } from "../types";

type DailyGrant = Extract<SfuJoinGrant, { provider: "daily" }>;

/**
 * Daily is the web app's fallback provider, and the grant contract for it is already honoured
 * here (see `join-grant-schema`). The native driver is not linked into this build:
 * `@daily-co/react-native-daily-js` and `@cloudflare/realtimekit-react-native` each ship their own
 * fork of `react-native-webrtc` under the same `react-native-webrtc` podspec, so one binary holds
 * one of them. Production serves RealtimeKit grants, so that is the fork this app carries.
 *
 * Wiring Daily back is one file: implement `CallDriver` over `Daily.createCallObject()` with
 * `join({ url, token, userName })`, `participants()` and `DailyMediaView`, and return it from here.
 * The previous implementation lives in git history on the `add-cal-video-deeplink` branch.
 */
export function createDailyCallDriver(grant: DailyGrant): CallDriver {
  void grant;
  throw new CalVideoError(
    "unsupported-provider",
    "This meeting runs on a video provider this version of the app cannot join yet. Open it in your browser or update the app."
  );
}
