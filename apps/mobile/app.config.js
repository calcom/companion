const appConfig = require("./app.json");

module.exports = {
  ...appConfig,
  expo: {
    ...appConfig.expo,
    android: {
      ...appConfig.expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
  },
};
