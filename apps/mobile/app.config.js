const { withGradleProperties } = require("expo/config-plugins");
const appConfig = require("./app.json");

// SDK 58 turns R8 on for release builds. RealtimeKit's WebRTC and react-native-android-widget's
// WorkManager have no keep rules that survive it, so the app crashes at launch. Keep it off.
const withoutReleaseMinify = (config) =>
  withGradleProperties(config, (config) => {
    const property = config.modResults.find(
      (item) => item.type === "property" && item.key === "android.enableMinifyInReleaseBuilds"
    );
    if (property) property.value = "false";
    return config;
  });

module.exports = {
  ...appConfig,
  expo: {
    ...appConfig.expo,
    android: {
      ...appConfig.expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
    plugins: [...appConfig.expo.plugins, withoutReleaseMinify],
  },
};
