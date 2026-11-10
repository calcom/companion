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
  "android.hardware.camera",
  "android.hardware.camera.autofocus",
  "android.hardware.microphone",
  "android.hardware.telephony",
  "android.hardware.bluetooth",
];

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withOptionalAndroidFeatures = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults).manifest;
    manifest["uses-feature"] ??= [];
    const declared = new Set(manifest["uses-feature"].map((feature) => feature.$["android:name"]));
    for (const name of OPTIONAL_FEATURES) {
      // Another plugin already decided about this feature: leave its entry alone.
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
