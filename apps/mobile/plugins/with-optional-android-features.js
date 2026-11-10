/**
 * Declares the hardware the app can live without as `android:required="false"`.
 *
 * Google Play treats some permissions as hardware requirements unless the manifest says
 * otherwise, and hides the app from devices without that hardware. Without these entries,
 * CAMERA hides it from devices without a back camera or autofocus (Chromebooks, cars, TVs, many
 * tablets), RECORD_AUDIO from devices without a microphone, and CALL_PHONE (react-native-callkeep)
 * from Wi-Fi-only tablets and Chromebooks. Every one of these is optional here: QR check-in and
 * Cal Video degrade when the hardware is missing, event photos come from the photo library, and
 * calls are self-managed VoIP that never touch the cellular network.
 *
 * `android:required` is OR-merged across manifests, so a library that declares a feature without
 * `required="false"` (RealtimeKit does for the camera) would win over ours. `tools:replace` makes
 * the app's value the one that ships.
 */
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const OPTIONAL_FEATURES = [
  // CAMERA (expo-camera, expo-image-picker, RealtimeKit, which also declares the feature itself).
  // Used by the QR check-in scanner (app/event-check-in-scanner.tsx) and Cal Video's camera.
  "android.hardware.camera",
  // Implied by CAMERA alongside the camera. Only the QR check-in scanner needs focus.
  "android.hardware.camera.autofocus",
  // RECORD_AUDIO (expo-camera, RealtimeKit). Used for Cal Video audio.
  "android.hardware.microphone",
  // CALL_PHONE (react-native-callkeep). Used only to show Cal Video in the system call UI;
  // calls are self-managed VoIP (services/cal-video/native-call.ts), never the phone line.
  "android.hardware.telephony",
  // BLUETOOTH (react-native-webrtc, RealtimeKit). Used to route Cal Video audio to a headset.
  "android.hardware.bluetooth",
];

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withOptionalAndroidFeatures = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults).manifest;
    manifest["uses-feature"] ??= [];
    const declared = new Set(manifest["uses-feature"].map((feature) => feature.$["android:name"]));
    for (const name of OPTIONAL_FEATURES) {
      // Another plugin already decided about this feature: leave its entry alone. Mods run in
      // reverse plugin order, so this is listed first in app.json to see every other entry.
      if (declared.has(name)) continue;
      manifest["uses-feature"].push({
        $: {
          "android:name": name,
          "android:required": "false",
          "tools:replace": "android:required",
        },
      });
    }
    return config;
  });

module.exports = withOptionalAndroidFeatures;
