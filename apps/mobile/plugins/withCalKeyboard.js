const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = path.join(__dirname, "android");

function copyFile(projectRoot, source, destination) {
  const destinationPath = path.join(projectRoot, destination);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, source), destinationPath);
}

module.exports = function withCalKeyboard(config) {
  config = withDangerousMod(config, [
    "android",
    (config) => {
      copyFile(
        config.modRequest.projectRoot,
        "CalKeyboardService.kt",
        "android/app/src/main/java/com/calcom/companion/keyboard/CalKeyboardService.kt"
      );
      copyFile(
        config.modRequest.projectRoot,
        "cal_keyboard_method.xml",
        "android/app/src/main/res/xml/cal_keyboard_method.xml"
      );
      return config;
    },
  ]);

  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      return config;
    }

    const service = {
      $: {
        "android:name": ".keyboard.CalKeyboardService",
        "android:label": "Cal.com Keyboard",
        "android:permission": "android.permission.BIND_INPUT_METHOD",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.view.InputMethod" } }],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.view.im",
            "android:resource": "@xml/cal_keyboard_method",
          },
        },
      ],
    };
    const services = application.service ?? [];
    application.service = services.filter(
      (item) => item.$?.["android:name"] !== service.$["android:name"]
    );
    application.service.push(service);
    return config;
  });
};
